import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EditorGateway } from './editor.gateway';
import { Room } from '../rooms/entities/room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room])],
  providers: [EditorGateway],
  exports: [EditorGateway],
})
export class EditorModule {}
