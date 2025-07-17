// voice.module.ts -> 음성채팅 소켓 서버 코드 simple-peer / p2p 방식 사용
// 현재 사용하지 않음 -> openvidu sfu 방식으로 전환
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoiceGateway } from './voice.gateway';
import { Room } from '../rooms/entities/room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room])],
  providers: [VoiceGateway],
  exports: [VoiceGateway],
})
export class VoiceModule {}
