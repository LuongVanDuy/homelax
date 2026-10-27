import { Module } from '@nestjs/common';
import { IntakeService } from './intake.service.js';
import { IntakeAdminController, PublicIntakeController } from './intake.controller.js';

@Module({ controllers: [PublicIntakeController, IntakeAdminController], providers: [IntakeService] })
export class IntakeModule {}
