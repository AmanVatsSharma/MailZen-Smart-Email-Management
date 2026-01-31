# Organization Module

## Overview

The Organization module provides functionality for managing organizational elements within the MailZen application, specifically focusing on labels. Labels help users organize and categorize their emails for better management and retrieval.

## Features

- **Label Management**: Create, read, and retrieve labels
- **Color Coding**: Assign colors to labels for visual organization
- **GraphQL API**: Expose label operations through GraphQL
- **Authentication**: Secure label operations with JWT authentication

## Architecture

The Organization module follows a clean architecture pattern with the following components:

- **LabelService**: Core business logic for label operations
- **LabelResolver**: GraphQL API for exposing label functionality
- **DTOs**: Data Transfer Objects for input validation
- **Entity**: GraphQL object type representing a label

## API

### GraphQL Queries

#### Get All Labels

```graphql
query {
  getAllLabels {
    id
    name
    color
  }
}
```

Returns an array of all labels.

#### Get Label by ID

```graphql
query {
  getLabel(id: "label-id") {
    id
    name
    color
  }
}
```

Returns a single label by ID.

### GraphQL Mutations

#### Create Label

```graphql
mutation {
  createLabel(createLabelInput: {
    name: "Important",
    color: "#FF0000"
  }) {
    id
    name
    color
  }
}
```

Creates a new label and returns the created label.

## Future Enhancements

- **Update and Delete Operations**: Add functionality to update and delete labels
- **User-Specific Labels**: Associate labels with specific users
- **Label Hierarchies**: Support for nested labels or categories
- **Prisma Integration**: Store labels in the database using Prisma ORM
- **Bulk Operations**: Support for bulk creation, update, and deletion of labels

## Usage

1. Import the `LabelModule` in your application module:

```typescript
import { Module } from '@nestjs/common';
import { LabelModule } from './organization/label.module';

@Module({
  imports: [LabelModule],
})
export class AppModule {}
```

2. Inject the `LabelService` in your service or controller:

```typescript
import { Injectable } from '@nestjs/common';
import { LabelService } from '../organization/label.service';

@Injectable()
export class EmailService {
  constructor(private readonly labelService: LabelService) {}

  async categorizeEmail(emailId: string, labelId: string) {
    const label = await this.labelService.getLabelById(labelId);
    // Associate email with label
  }
}
```

## Planned Database Schema

The planned Label model for Prisma schema:

```prisma
model Label {
  id        String   @id @default(uuid())
  name      String
  color     String?
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Dependencies

- NestJS framework
- GraphQL
- JWT Authentication 