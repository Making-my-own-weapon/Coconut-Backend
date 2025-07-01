// src/users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Problem } from '../../problems/entities/problem.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Column({ nullable: true }) dummy: string;
  @OneToMany(() => Problem, (problem) => problem.creator)
  createdProblems: Problem[];
}
