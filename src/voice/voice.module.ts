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
