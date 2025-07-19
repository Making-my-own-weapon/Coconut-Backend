import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../rooms/entities/room.entity';

interface ConnectedUser {
  socketId: string;
  userId: number;
  userName: string;
  role: 'teacher' | 'student';
  roomId: string; // 내부 식별자(문자열)
  inviteCode: string;
}

// SVGLine 인터페이스가 없으면 추가
interface SVGLine {
  points: [number, number][];
  color: string;
}

@WebSocketGateway({
  port: 3001,
  cors: { origin: '*' },
})
export class EditorGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private connectedUsers = new Map<string, ConnectedUser>(); // socketId -> user
  private roomUsers = new Map<string, Set<string>>(); // roomId -> Set<socketId>
  private collaborations = new Map<
    string,
    { teacherSocketId: string; studentSocketId: string }
  >(); // collaborationId -> { teacherSocketId, studentSocketId }
  private collaborationSVGs = new Map<string, SVGLine[]>(); // collaborationId -> lines

  // (voiceUsers, roomVoiceUsers 상태 삭제)
  // (handleVoiceJoin, handleVoiceSignal, handleVoiceLeave 메서드 전체 삭제)

  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      // 방에서 제거
      const users = this.roomUsers.get(user.roomId);
      if (users) {
        users.delete(client.id);
        if (users.size === 0) this.roomUsers.delete(user.roomId);
      }
      this.connectedUsers.delete(client.id);

      // 해당 사용자가 참여한 협업 세션들 정리
      for (const [
        collaborationId,
        collaboration,
      ] of this.collaborations.entries()) {
        if (
          collaboration.teacherSocketId === client.id ||
          collaboration.studentSocketId === client.id
        ) {
          // 상대방에게 협업 종료 알림
          const targetSocketId =
            collaboration.teacherSocketId === client.id
              ? collaboration.studentSocketId
              : collaboration.teacherSocketId;
          this.server.to(targetSocketId).emit('collab:ended');
          this.collaborations.delete(collaborationId);
          console.log(
            `사용자 연결 해제로 인한 협업 세션 종료: ${collaborationId}`,
          );
        }
      }
    }
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      roomId: string; // 내부 식별자(문자열)
      inviteCode: string; // 외부 공유 코드(문자열)
      userId: number;
      userName: string;
      role: 'teacher' | 'student';
    },
  ) {
    console.log('room:join 수신', payload, client.id);
    // DB에서 방 정보 조회 (inviteCode로 조회)
    const room = await this.roomRepository.findOne({
      where: { inviteCode: payload.inviteCode },
    });
    if (!room) {
      client.emit('room:notfound');
      return;
    }
    const maxParticipants = room.maxParticipants;

    let users = this.roomUsers.get(payload.roomId);
    if (!users) {
      users = new Set();
      this.roomUsers.set(payload.roomId, users);
    }
    if (users.size >= maxParticipants) {
      client.emit('room:full');
      return;
    }
    users.add(client.id);
    this.connectedUsers.set(client.id, { ...payload, socketId: client.id });
    client.join(`room_${payload.inviteCode}`);
    client.emit('room:joined', {
      roomId: payload.roomId,
      inviteCode: payload.inviteCode,
    });
    console.log(
      `${payload.role} ${payload.userName} joined room ${payload.inviteCode}`,
    );

    // 학생이 입장하면 방 전체에 room:updated broadcast
    void this.server.to(`room_${payload.inviteCode}`).emit('room:updated');
    console.log('room:updated emit (join)', payload.inviteCode);
  }

  @SubscribeMessage('room:leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { roomId: string; userId: number; inviteCode: string },
  ) {
    // 1. 메모리에서 제거
    this.connectedUsers.delete(client.id);
    const users = this.roomUsers.get(payload.roomId);
    if (users) {
      users.delete(client.id);
      if (users.size === 0) this.roomUsers.delete(payload.roomId);
    }
    client.leave(`room_${payload.inviteCode}`);

    // 2. DB에서 participants에서 해당 학생 제거
    const room = await this.roomRepository.findOne({
      where: { inviteCode: payload.inviteCode },
    });
    if (room) {
      room.participants = (room.participants || []).filter(
        (p: {
          userId: number;
          name: string;
          userType: 'teacher' | 'student';
        }) => String(p.userId) !== String(payload.userId),
      );
      await this.roomRepository.save(room);
    }

    // 3. 방 전체에 room:updated broadcast
    void this.server.to(`room_${payload.inviteCode}`).emit('room:updated');
    console.log('room:updated emit (leave)', payload.inviteCode);
  }

  @SubscribeMessage('collab:start')
  handleCollabStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { roomId: string; inviteCode: string; studentId: number },
  ) {
    console.log('collab:start 수신', payload, client.id);

    const collaborationId = `collab_${payload.inviteCode}_${payload.studentId}`;
    const teacherSocketId = client.id;
    const studentSocketId = [...this.connectedUsers.entries()].find(
      ([, user]) =>
        user.userId === payload.studentId && user.roomId === payload.roomId,
    )?.[0];

    if (studentSocketId) {
      // 1:1 협업 룸에 join (teacherSocketId와 studentSocketId를 함께 저장)
      this.collaborations.set(collaborationId, {
        teacherSocketId,
        studentSocketId,
      });
      // 학생에게 코드 요청
      this.server
        .to(studentSocketId)
        .emit('code:request', { collaborationId, teacherSocketId });
      console.log(
        `협업 시작 요청: ${collaborationId} - teacher(${teacherSocketId}) -> student(${studentSocketId})`,
      );
    } else {
      console.log(
        `학생을 찾을 수 없음: studentId=${payload.studentId}, roomId=${payload.roomId}`,
      );
    }
  }

  @SubscribeMessage('code:send')
  handleCodeSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { collaborationId: string; problemId: number; code: string },
  ) {
    // 학생이 보낸 코드를 선생님에게 전달 (저장된 teacherSocketId 사용)
    console.log('code:send 수신!', payload);

    const collaboration = this.collaborations.get(payload.collaborationId);
    if (collaboration) {
      // 저장된 teacherSocketId 사용 (학생이 보낸 teacherSocketId 대신)
      this.server.to(collaboration.teacherSocketId).emit('code:send', {
        collaborationId: payload.collaborationId,
        problemId: payload.problemId,
        code: payload.code,
      });

      // 협업 세션 시작 알림(양쪽)
      this.server
        .to(collaboration.teacherSocketId)
        .emit('collab:started', { collaborationId: payload.collaborationId });
      this.server
        .to(collaboration.studentSocketId)
        .emit('collab:started', { collaborationId: payload.collaborationId });

      console.log(
        `학생 코드 전송 및 협업 세션 시작: ${payload.collaborationId}`,
      );
    } else {
      console.log(`협업 세션을 찾을 수 없음: ${payload.collaborationId}`);
    }
  }

  @SubscribeMessage('collab:edit')
  handleCollabEdit(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { collaborationId: string; problemId: number; code: string },
  ) {
    console.log('[Server] handleCollabEdit payload:', payload);
    // 1:1 협업 룸에만 broadcast (저장된 소켓 ID 사용)
    const collaboration = this.collaborations.get(payload.collaborationId);
    if (collaboration) {
      const targetSocketId =
        client.id === collaboration.teacherSocketId
          ? collaboration.studentSocketId
          : collaboration.teacherSocketId;

      this.server.to(targetSocketId).emit('code:update', {
        collaborationId: payload.collaborationId,
        problemId: payload.problemId,
        code: payload.code,
      });
    } else {
      console.log(`협업 세션을 찾을 수 없음: ${payload.collaborationId}`);
    }
  }

  @SubscribeMessage('collab:end')
  handleCollabEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { collaborationId: string },
  ) {
    const collaboration = this.collaborations.get(payload.collaborationId);
    if (collaboration) {
      // 양쪽 모두에게 협업 종료 알림
      this.server.to(collaboration.teacherSocketId).emit('collab:ended');
      this.server.to(collaboration.studentSocketId).emit('collab:ended');

      this.collaborations.delete(payload.collaborationId);
      // SVG 데이터도 정리
      this.collaborationSVGs.delete(payload.collaborationId);
      console.log(`협업 종료: ${payload.collaborationId}`);
    }
  }

  @SubscribeMessage('cursor:update')
  handleCursorUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      collaborationId: string;
      lineNumber: number;
      column: number;
      problemId: number;
    },
  ) {
    const collaboration = this.collaborations.get(payload.collaborationId);
    if (collaboration) {
      const targetSocketId =
        client.id === collaboration.teacherSocketId
          ? collaboration.studentSocketId
          : collaboration.teacherSocketId;

      this.server.to(targetSocketId).emit('cursor:update', {
        lineNumber: payload.lineNumber,
        column: payload.column,
        problemId: payload.problemId,
      });
      // (선택) 로그
      // console.log(
      //   `커서 동기화: ${payload.collaborationId} - ${client.id} -> ${targetSocketId} (${payload.lineNumber},${payload.column})`,
      // );
    } else {
      console.log(`협업 세션을 찾을 수 없음!: ${payload.collaborationId}`);
    }
  }

  // SVG 관련 이벤트 핸들러들
  @SubscribeMessage('updateSVG')
  handleUpdateSVG(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { collaborationId: string; lines: SVGLine[] },
  ) {
    console.log(
      'updateSVG 수신:',
      payload.collaborationId,
      '라인 수:',
      payload.lines.length,
    );
    this.collaborationSVGs.set(payload.collaborationId, payload.lines);

    // 협업 세션의 상대방에게만 전송
    const collaboration = this.collaborations.get(payload.collaborationId);
    if (collaboration) {
      const targetSocketId =
        client.id === collaboration.teacherSocketId
          ? collaboration.studentSocketId
          : collaboration.teacherSocketId;

      this.server.to(targetSocketId).emit('svgData', { lines: payload.lines });
      console.log(
        `SVG 데이터 전송: ${payload.collaborationId} -> ${targetSocketId}`,
      );
    } else {
      console.log(`협업 세션을 찾을 수 없음: ${payload.collaborationId}`);
    }
  }

  @SubscribeMessage('clearSVG')
  handleClearSVG(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { collaborationId: string },
  ) {
    this.collaborationSVGs.set(payload.collaborationId, []);

    // 협업 세션의 상대방에게만 전송
    const collaboration = this.collaborations.get(payload.collaborationId);
    if (collaboration) {
      const targetSocketId =
        client.id === collaboration.teacherSocketId
          ? collaboration.studentSocketId
          : collaboration.teacherSocketId;

      this.server.to(targetSocketId).emit('svgCleared');
      console.log(
        `SVG 클리어 전송: ${payload.collaborationId} -> ${targetSocketId}`,
      );
    } else {
      console.log(`협업 세션을 찾을 수 없음: ${payload.collaborationId}`);
    }
  }

  // 음성채팅 관련 이벤트 핸들러들
  // (handleVoiceJoin, handleVoiceSignal, handleVoiceLeave 메서드 전체 삭제)

  @SubscribeMessage('teacher:requestStudentCode')
  handleTeacherRequestStudentCode(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { collaborationId: string; problemId: number },
  ) {
    // collaborationId로 학생 소켓 ID 찾기
    const collaboration = this.collaborations.get(payload.collaborationId);
    if (collaboration) {
      // 선생님이 보낸 요청을 학생에게 전달
      this.server
        .to(collaboration.studentSocketId)
        .emit('teacher:requestStudentCode', {
          collaborationId: payload.collaborationId,
          problemId: payload.problemId,
        });
    }
  }

  @SubscribeMessage('student:sendCode')
  handleStudentSendCode(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { collaborationId: string; problemId: number; code: string },
  ) {
    // collaborationId로 선생님 소켓 ID 찾기
    const collaboration = this.collaborations.get(payload.collaborationId);
    if (collaboration) {
      // 학생이 보낸 코드를 선생님에게 전달
      this.server.to(collaboration.teacherSocketId).emit('student:sendCode', {
        collaborationId: payload.collaborationId,
        problemId: payload.problemId,
        code: payload.code,
      });
    }
  }

  @SubscribeMessage('student:currentProblem')
  handleStudentCurrentProblem(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      roomId: string;
      inviteCode: string;
      studentId: number;
      problemId: number;
    },
  ) {
    this.server
      .to(`room_${payload.inviteCode}`)
      .emit('student:currentProblem', payload);
  }
}
