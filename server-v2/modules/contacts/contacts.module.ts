import { Module } from '@nestjs/common';
import { CollaboratorsController } from './collaborators.controller.js';
import { ContactsAccessService } from './contacts-access.service.js';
import { ContactsService } from './contacts.service.js';
import { CustomersController } from './customers.controller.js';

@Module({
  controllers: [CustomersController, CollaboratorsController],
  providers: [ContactsService, ContactsAccessService],
})
export class ContactsModule {}
