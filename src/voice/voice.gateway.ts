// voice.gateway.ts -> 음성채팅 소켓 서버 코드 simple-peer / p2p 방식 사용
// 현재 사용하지 않음 -> openvidu sfu 방식으로 전환
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayDisconnect,
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
  roomId: string;
  inviteCode: string;
}

@WebSocketGateway({
  port: 3001,
  cors: { origin: '*' },
})
export class VoiceGateway implements OnGatewayDisconnect {
  private voiceUsers = new Map<string, ConnectedUser>(); // socketId -> user (음성채팅 참가자)
  private roomVoiceUsers = new Map<string, Set<string>>(); // roomId -> Set<socketId> (방별 음성채팅 참가자)

  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  handleDisconnect(client: Socket) {
    const user = this.voiceUsers.get(client.id);
    if (user) {
      this.voiceUsers.delete(client.id);
      const voiceUsers = this.roomVoiceUsers.get(user.roomId);
      if (voiceUsers) {
        voiceUsers.delete(client.id);
        if (voiceUsers.size === 0) {
          this.roomVoiceUsers.delete(user.roomId);
        }
      }
      // 방의 다른 음성채팅 참가자들에게 퇴장 알림 (roomId 기준)
      this.server.to(`room_${user.roomId}`).emit('voice:leave', {
        userId: user.userId,
      });
      console.log(
        `${user.role} ${user.userName} (disconnect) left voice chat in room ${user.roomId}`,
      );
    }
  }

  @SubscribeMessage('voice:join')
  handleVoiceJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      roomId: string;
      userId: number;
      userName: string;
      userRole: 'teacher' | 'student';
    },
  ) {
    console.log('voice:join 수신', payload, client.id);

    // 반드시 소켓을 방에 join
    client.join(`room_${payload.roomId}`);

    // 사용자 정보 생성
    const user = {
      socketId: client.id,
      userId: payload.userId,
      userName: payload.userName,
      role: payload.userRole,
      roomId: payload.roomId,
      inviteCode: '',
    };

    // 1. 자신을 음성채팅 참가자로 등록
    this.voiceUsers.set(client.id, user);

    let voiceUsers = this.roomVoiceUsers.get(payload.roomId);
    if (!voiceUsers) {
      voiceUsers = new Set();
      this.roomVoiceUsers.set(payload.roomId, voiceUsers);
    }
    voiceUsers.add(client.id);

    // 2. roomVoiceUsers에서 voiceUsers에 없는 소켓ID는 제거 (동기화)
    for (const socketId of Array.from(voiceUsers)) {
      if (!this.voiceUsers.has(socketId)) {
        voiceUsers.delete(socketId);
      }
    }

    // 3. 기존 참가자 목록 전송 (이제 본인도 등록된 상태, 본인은 제외)
    const existingParticipants = Array.from(voiceUsers)
      .map((socketId) => {
        const participant = this.voiceUsers.get(socketId);
        return participant && participant.socketId !== client.id // 본인 제외
          ? {
              userId: participant.userId,
              userName: participant.userName,
              userRole: participant.role,
            }
          : null;
      })
      .filter(Boolean);

    if (existingParticipants.length > 0) {
      this.server
        .to(client.id)
        .emit('voice:existing-participants', existingParticipants);
      console.log('기존 참가자 목록 전송:', existingParticipants);
    }

    // 4. 방 전체에 새 참가자 알림 (roomId 기준)
    this.server.to(`room_${payload.roomId}`).emit('voice:user-joined', {
      userId: user.userId,
      userName: user.userName,
      userRole: user.role,
    });

    console.log(
      `${user.role} ${user.userName} joined voice chat in room ${payload.roomId}`,
    );
  }

  @SubscribeMessage('voice:signal')
  handleVoiceSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      roomId: string;
      to: number | string; // 대상 사용자 ID
      signal: Record<string, unknown>; // WebRTC 시그널링 데이터
    },
  ) {
    console.log('voice:signal 수신', { from: client.id, to: payload.to });

    // userId 비교 시 항상 String으로 통일
    const targetUser = [...this.voiceUsers.entries()].find(
      ([, user]) =>
        String(user.userId) === String(payload.to) &&
        user.roomId === payload.roomId,
    );

    if (targetUser) {
      const [targetSocketId] = targetUser;

      // 시그널링 데이터를 대상 사용자에게 전달
      this.server.to(targetSocketId).emit('voice:signal', {
        from: this.voiceUsers.get(client.id)?.userId,
        signal: payload.signal,
      });

      console.log(
        `음성 시그널링: ${client.id} -> ${targetSocketId} (${payload.to})`,
      );
    } else {
      console.log(`음성채팅 대상 사용자를 찾을 수 없음: userId=${payload.to}`);
    }
  }

  @SubscribeMessage('voice:leave')
  handleVoiceLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      roomId: string;
      userId: number;
    },
  ) {
    console.log('voice:leave 수신', payload, client.id);

    // 사용자 정보 가져오기
    const user = this.voiceUsers.get(client.id);
    if (!user) {
      console.log(
        '음성채팅 퇴장 실패: 사용자가 음성채팅에 참가하지 않음',
        client.id,
      );
      return;
    }

    // 음성채팅 참가자에서 제거
    this.voiceUsers.delete(client.id);

    const voiceUsers = this.roomVoiceUsers.get(payload.roomId);
    if (voiceUsers) {
      voiceUsers.delete(client.id);
      if (voiceUsers.size === 0) {
        this.roomVoiceUsers.delete(payload.roomId);
      }
    }

    // 방의 다른 음성채팅 참가자들에게 퇴장 알림 (roomId 기준)
    this.server.to(`room_${payload.roomId}`).emit('voice:leave', {
      userId: user.userId,
    });

    console.log(
      `${user.role} ${user.userName} left voice chat in room ${payload.roomId}`,
    );
  }
}
