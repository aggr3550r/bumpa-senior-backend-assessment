import { Body, Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { ResponseModel } from '../../models/response.model';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findUsers() {
    const users = await this.usersService.findUsers();

    return ResponseModel.success('Users retrieved successfully', users);
  }

  @Post()
  async createUser(@Body() body: CreateUserDto) {
    const user = await this.usersService.createUser(body);

    return ResponseModel.success(
      'User created successfully',
      user,
      undefined,
      HttpStatus.CREATED,
    );
  }
}
