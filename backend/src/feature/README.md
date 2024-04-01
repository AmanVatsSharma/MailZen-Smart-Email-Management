# Feature Module

## Overview

The Feature module provides functionality for managing feature flags within the MailZen application. Feature flags allow for controlled rollout of new features, A/B testing, and feature toggling based on user roles or subscription levels.

## Features

- **Feature Flag Management**: Create, read, update, and delete feature flags
- **Feature Toggling**: Enable or disable features dynamically
- **Admin-Only Access**: Restrict feature management to admin users
- **GraphQL API**: Expose feature operations through GraphQL
- **Authentication & Authorization**: Secure feature operations with JWT authentication and role-based access control

## Architecture

The Feature module follows a clean architecture pattern with the following components:

- **FeatureService**: Core business logic for feature operations
- **FeatureResolver**: GraphQL API for exposing feature functionality
- **DTOs**: Data Transfer Objects for input validation
- **Entity**: GraphQL object type representing a feature
- **Guards**: Role-based access control for admin-only operations

## API

### GraphQL Queries

#### Get All Features

```graphql
query {
  getAllFeatures {
    id
    name
    isActive
  }
}
```

Returns an array of all features.

### GraphQL Mutations (Admin Only)

#### Create Feature

```graphql
mutation {
  createFeature(createFeatureInput: {
    name: "EmailTemplates",
    isActive: true
  }) {
    id
    name
    isActive
  }
}
```

Creates a new feature flag and returns the created feature.

#### Update Feature

```graphql
mutation {
  updateFeature(updateFeatureInput: {
    id: "feature-id",
    isActive: false
  }) {
    id
    name
    isActive
  }
}
```

Updates an existing feature flag and returns the updated feature.

#### Delete Feature

```graphql
mutation {
  deleteFeature(id: "feature-id") {
    id
    name
    isActive
  }
}
```

Deletes a feature flag and returns the deleted feature.

## Usage

1. Import the `FeatureModule` in your application module:

```typescript
import { Module } from '@nestjs/common';
import { FeatureModule } from './feature/feature.module';

@Module({
  imports: [FeatureModule],
})
export class AppModule {}
```

2. Inject the `FeatureService` in your service or controller to check if a feature is enabled:

```typescript
import { Injectable } from '@nestjs/common';
import { FeatureService } from '../feature/feature.service';

@Injectable()
export class EmailService {
  constructor(private readonly featureService: FeatureService) {}

  async sendEmail(emailData: any) {
    // Check if the email templates feature is enabled
    const emailTemplatesFeature = this.featureService.getFeatureByName('EmailTemplates');
    
    if (emailTemplatesFeature && emailTemplatesFeature.isActive) {
      // Use email templates functionality
    } else {
      // Use basic email sending
    }
    
    // Send the email
  }
}
```

## Future Enhancements

- **Prisma Integration**: Store features in the database using Prisma ORM
- **User-Specific Features**: Enable features for specific users or user groups
- **Percentage Rollout**: Gradually roll out features to a percentage of users
- **Time-Based Activation**: Schedule feature activation and deactivation
- **Metrics Collection**: Track feature usage and performance

## Planned Database Schema

The planned Feature model for Prisma schema:

```prisma
model Feature {
  id        String   @id @default(uuid())
  name      String   @unique
  isActive  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Dependencies

- NestJS framework
- GraphQL
- JWT Authentication
- Role-based Authorization 