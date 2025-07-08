import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findOneByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const newUser = this.userRepository.create(userData);
    return this.userRepository.save(newUser);
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    await this.userRepository.update(id, userData);

    // findOneBy의 결과를 일단 변수에 담습니다.
    const updatedUser = await this.userRepository.findOneBy({ id });

    // 만약 결과가 null이면, '사용자를 찾을 수 없다'는 에러를 발생시킵니다.
    if (!updatedUser) {
      throw new NotFoundException(`ID가 ${id}인 사용자를 찾을 수 없습니다.`);
    }

    // null이 아님이 확실해졌으므로, 안전하게 반환합니다.
    return updatedUser;
  }

  // 👇 --- ID로 사용자 찾는 메서드 추가 --- 👇
  async findOneById(id: number): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  async deleteUser(userId: number): Promise<void> {
    // TypeORM의 delete 메서드를 사용해 id가 일치하는 유저를 삭제합니다.
    const deleteResult = await this.userRepository.delete({ id: userId });

    // 만약 삭제된 행이 없다면(affected === 0), 해당 유저가 없다는 뜻이므로 에러를 발생시킵니다.
    if (deleteResult.affected === 0) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  }
}
