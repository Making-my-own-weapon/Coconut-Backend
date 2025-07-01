import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class EditorGateway {
  /**
   * 클라이언트를 특정 에디터에 참여시킴
   * 같은 editorId에 참여한 사람들끼리만 협업 가능
   * join()
   *    - socket.io에서 제공하는 기본 기능
   *    - 실시간 협업 상황에서 특정 그룹에 메시지를 보내기 위해 클라이언트를 같은 그룹에 넣음
   */
  @SubscribeMessage('joinEditor')
  handleJoinEditor(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { editorId: string },
  ) {
    client.join(`editor_${payload.editorId}`); // ex) editor_5라는 이름으로 join됨
    console.log('editor ', payload.editorId, ' joined.');
  }

  /* 같은 editorId를 가진 모든 클라이언트에게 broadcast */
  @SubscribeMessage('editCode')
  handleEditCode(
    @ConnectedSocket() client: Socket, //요청을 보낸 클라이언트의 객체
    @MessageBody() payload: { editorId: string; code: string },
  ) {
    //클라이언트가 보낸 데이터를 받아오는 부분
    client.to(`editor_${payload.editorId}`).emit('editorUpdated', payload);
  }
}
