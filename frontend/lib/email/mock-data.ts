import { Email, EmailFolder, EmailLabel, EmailParticipant, EmailThread } from './email-types';

export const mockLabels: EmailLabel[] = [
  { id: 'label-1', name: 'Important', color: '#ef4444', isSystem: true },
  { id: 'label-2', name: 'Work', color: '#3b82f6', isSystem: false },
  { id: 'label-3', name: 'Personal', color: '#10b981', isSystem: false },
  { id: 'label-4', name: 'Finance', color: '#f59e0b', isSystem: false },
  { id: 'label-5', name: 'Social', color: '#8b5cf6', isSystem: true },
  { id: 'label-6', name: 'Promotions', color: '#ec4899', isSystem: true },
];

export const mockParticipants: EmailParticipant[] = [
  {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    avatar: 'https://i.pravatar.cc/150?u=user-1',
  },
  {
    id: 'user-2',
    name: 'Alice Smith',
    email: 'alice@example.com',
    avatar: 'https://i.pravatar.cc/150?u=user-2',
  },
  {
    id: 'user-3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    avatar: 'https://i.pravatar.cc/150?u=user-3',
  },
  {
    id: 'user-4',
    name: 'Emily Davis',
    email: 'emily@example.com',
    avatar: 'https://i.pravatar.cc/150?u=user-4',
  },
  {
    id: 'user-5',
    name: 'Michael Wilson',
    email: 'michael@example.com',
    avatar: 'https://i.pravatar.cc/150?u=user-5',
  },
  {
    id: 'current-user',
    name: 'You',
    email: 'you@example.com',
    avatar: 'https://i.pravatar.cc/150?u=current-user',
  },
];

// Generate mock emails
function createMockEmails(): Email[] {
  return [
    {
      id: 'email-1',
      threadId: 'thread-1',
      subject: 'Project Update - Q3 Goals',
      from: mockParticipants[1],
      to: [mockParticipants[5]],
      cc: [mockParticipants[2]],
      content: '<p>Hi team,</p><p>I wanted to share our Q3 goals and progress. We\'re currently on track to meet our objectives, but there are a few areas where we need to focus more attention.</p><p>Could we schedule a meeting to discuss this in more detail?</p><p>Best,<br>Alice</p>',
      contentPreview: 'Hi team, I wanted to share our Q3 goals and progress. We\'re currently on track to...',
      date: '2023-07-15T10:30:00Z',
      folder: 'inbox',
      isStarred: true,
      importance: 'high',
      attachments: [
        {
          id: 'attachment-1',
          name: 'Q3-Goals.pdf',
          type: 'application/pdf',
          size: 2457600,
        },
      ],
      status: 'unread',
      labelIds: ['label-2'],
      providerId: 'provider-1',
    },
    {
      id: 'email-2',
      threadId: 'thread-1',
      subject: 'Re: Project Update - Q3 Goals',
      from: mockParticipants[5],
      to: [mockParticipants[1]],
      cc: [mockParticipants[2]],
      content: '<p>Hi Alice,</p><p>Thanks for the update. I\'ve reviewed the goals and have a few questions about the timeline.</p><p>I\'m available for a meeting on Thursday afternoon if that works for everyone.</p><p>Regards,<br>Me</p>',
      contentPreview: 'Hi Alice, Thanks for the update. I\'ve reviewed the goals and have a few questions...',
      date: '2023-07-15T14:22:00Z',
      folder: 'sent',
      isStarred: false,
      importance: 'normal',
      attachments: [],
      status: 'read',
      labelIds: ['label-2'],
      providerId: 'provider-1',
    },
    {
      id: 'email-3',
      threadId: 'thread-1',
      subject: 'Re: Project Update - Q3 Goals',
      from: mockParticipants[1],
      to: [mockParticipants[5]],
      cc: [mockParticipants[2]],
      content: '<p>Thursday works for me!</p><p>I\'ll send a calendar invite shortly. Please prepare any specific questions you have about the timeline so we can address them efficiently.</p><p>Best,<br>Alice</p>',
      contentPreview: 'Thursday works for me! I\'ll send a calendar invite shortly. Please prepare any...',
      date: '2023-07-15T15:10:00Z',
      folder: 'inbox',
      isStarred: false,
      importance: 'normal',
      attachments: [],
      status: 'unread',
      labelIds: ['label-2'],
      providerId: 'provider-1',
    },
    {
      id: 'email-4',
      threadId: 'thread-2',
      subject: 'Weekend Plans',
      from: mockParticipants[3],
      to: [mockParticipants[5]],
      content: '<p>Hey!</p><p>Are you free this weekend? We\'re planning a hike at Eagle Creek. Should be beautiful weather!</p><p>Let me know if you\'re interested.</p><p>Cheers,<br>Emily</p>',
      contentPreview: 'Hey! Are you free this weekend? We\'re planning a hike at Eagle Creek. Should be...',
      date: '2023-07-14T18:45:00Z',
      folder: 'inbox',
      isStarred: true,
      importance: 'normal',
      attachments: [
        {
          id: 'attachment-2',
          name: 'trail-map.jpg',
          type: 'image/jpeg',
          size: 1345600,
        },
      ],
      status: 'read',
      labelIds: ['label-3'],
      providerId: 'provider-2',
    },
    {
      id: 'email-5',
      threadId: 'thread-3',
      subject: 'Invoice #12345',
      from: mockParticipants[4],
      to: [mockParticipants[5]],
      content: '<p>Dear Customer,</p><p>Please find attached your invoice #12345 for services rendered in June 2023. Payment is due within 30 days.</p><p>Thank you for your business!</p><p>Regards,<br>Michael<br>Finance Department</p>',
      contentPreview: 'Dear Customer, Please find attached your invoice #12345 for services rendered in June 2023...',
      date: '2023-07-10T09:15:00Z',
      folder: 'inbox',
      isStarred: false,
      importance: 'high',
      attachments: [
        {
          id: 'attachment-3',
          name: 'Invoice-12345.pdf',
          type: 'application/pdf',
          size: 1245600,
        },
      ],
      status: 'read',
      labelIds: ['label-4'],
      providerId: 'provider-1',
    },
    {
      id: 'email-6',
      threadId: 'thread-4',
      subject: 'Team Lunch Next Week',
      from: mockParticipants[2],
      to: [mockParticipants[5], mockParticipants[1], mockParticipants[4]],
      content: '<p>Hi everyone,</p><p>I\'d like to organize a team lunch next week to celebrate our recent accomplishments. Does Wednesday work for most people?</p><p>Please let me know your food preferences and any dietary restrictions.</p><p>Thanks,<br>Bob</p>',
      contentPreview: 'Hi everyone, I\'d like to organize a team lunch next week to celebrate our recent...',
      date: '2023-07-13T11:20:00Z',
      folder: 'inbox',
      isStarred: false,
      importance: 'normal',
      attachments: [],
      status: 'read',
      labelIds: ['label-2', 'label-3'],
      providerId: 'provider-1',
    },
    {
      id: 'email-7',
      threadId: 'thread-5',
      subject: 'Your Subscription Renewal',
      from: {
        name: 'Netflix',
        email: 'info@netflix.com',
      },
      to: [mockParticipants[5]],
      content: '<p>Dear Customer,</p><p>Your Netflix subscription will automatically renew on July 25, 2023. Your card ending in 4321 will be charged $15.99.</p><p>If you wish to make changes to your subscription, please visit your account settings.</p><p>Thank you for being a Netflix member!</p>',
      contentPreview: 'Dear Customer, Your Netflix subscription will automatically renew on July 25, 2023...',
      date: '2023-07-11T08:05:00Z',
      folder: 'inbox',
      isStarred: false,
      importance: 'low',
      attachments: [],
      status: 'read',
      labelIds: ['label-5'],
      providerId: 'provider-2',
    },
    {
      id: 'email-8',
      threadId: 'thread-6',
      subject: 'Summer Sale - 50% Off All Items',
      from: {
        name: 'Fashion Store',
        email: 'marketing@fashionstore.com',
      },
      to: [mockParticipants[5]],
      content: '<p>SUMMER SALE!</p><p>Enjoy 50% off all items in our summer collection. Sale ends Sunday!</p><p>Shop now: <a href="#">fashionstore.com/sale</a></p>',
      contentPreview: 'SUMMER SALE! Enjoy 50% off all items in our summer collection. Sale ends Sunday!...',
      date: '2023-07-12T07:30:00Z',
      folder: 'inbox',
      isStarred: false,
      importance: 'low',
      attachments: [],
      status: 'read',
      labelIds: ['label-6'],
      providerId: 'provider-2',
    },
    {
      id: 'email-9',
      threadId: 'thread-7',
      subject: 'Meeting Notes - Product Strategy',
      from: mockParticipants[1],
      to: [mockParticipants[5], mockParticipants[2], mockParticipants[4]],
      content: '<p>Hi team,</p><p>Attached are the notes from our product strategy meeting yesterday. Please review and add any comments or missing items.</p><p>Key action items:</p><ul><li>Michael: Finalize Q4 roadmap</li><li>Bob: Follow up with design team</li><li>Me: Update stakeholders on timeline changes</li></ul><p>Next meeting scheduled for Aug 1.</p><p>Best,<br>Alice</p>',
      contentPreview: 'Hi team, Attached are the notes from our product strategy meeting yesterday. Please review...',
      date: '2023-07-08T16:40:00Z',
      folder: 'inbox',
      isStarred: true,
      importance: 'high',
      attachments: [
        {
          id: 'attachment-4',
          name: 'Product-Strategy-Notes.docx',
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 1856200,
        },
      ],
      status: 'read',
      labelIds: ['label-2'],
      providerId: 'provider-1',
    },
    {
      id: 'email-10',
      threadId: 'thread-8',
      subject: 'Happy Birthday!',
      from: mockParticipants[3],
      to: [mockParticipants[5]],
      content: '<p>Happy Birthday!</p><p>Wishing you a fantastic day and a great year ahead. Let\'s celebrate soon!</p><p>Cheers,<br>Emily</p>',
      contentPreview: 'Happy Birthday! Wishing you a fantastic day and a great year ahead. Let\'s celebrate soon!',
      date: '2023-07-09T09:00:00Z',
      folder: 'inbox',
      isStarred: true,
      importance: 'normal',
      attachments: [],
      status: 'read',
      labelIds: ['label-3'],
      providerId: 'provider-2',
    },
  ];
}

// Organize emails into threads
export function createMockThreads(): EmailThread[] {
  const emails = createMockEmails();
  const threads: Record<string, Email[]> = {};
  
  // Group emails by threadId
  emails.forEach(email => {
    if (!threads[email.threadId]) {
      threads[email.threadId] = [];
    }
    threads[email.threadId].push(email);
  });
  
  // Convert to EmailThread objects
  return Object.entries(threads).map(([threadId, messages]) => {
    // Sort messages by date (newest last)
    messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const lastMessage = messages[messages.length - 1];
    const uniqueParticipants = new Map<string, EmailParticipant>();
    
    messages.forEach(message => {
      uniqueParticipants.set(message.from.email, message.from);
      message.to.forEach(to => uniqueParticipants.set(to.email, to));
      if (message.cc) {
        message.cc.forEach(cc => uniqueParticipants.set(cc.email, cc));
      }
    });
    
    // Remove current user from participants list
    uniqueParticipants.delete('you@example.com');
    
    return {
      id: threadId,
      subject: messages[0].subject,
      participants: Array.from(uniqueParticipants.values()),
      lastMessageDate: lastMessage.date,
      isUnread: messages.some(message => message.status === 'unread' && message.folder === 'inbox'),
      messages,
      folder: lastMessage.folder,
      labelIds: lastMessage.labelIds,
      providerId: lastMessage.providerId,
    };
  });
}

export const mockThreads = createMockThreads();

// Function to get paginated threads
export function getPaginatedThreads(
  page: number = 1,
  pageSize: number = 10,
  folder: EmailFolder = 'inbox',
  search?: string,
  labelIds?: string[],
): { items: EmailThread[]; total: number; page: number; pageSize: number; hasMore: boolean } {
  let filteredThreads = mockThreads.filter(thread => {
    // Filter by folder
    if (folder && thread.folder !== folder) {
      return false;
    }
    
    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      const inSubject = thread.subject.toLowerCase().includes(searchLower);
      const inContent = thread.messages.some(message => 
        message.content.toLowerCase().includes(searchLower) || 
        message.contentPreview.toLowerCase().includes(searchLower)
      );
      const inParticipants = thread.participants.some(participant => 
        participant.name.toLowerCase().includes(searchLower) || 
        participant.email.toLowerCase().includes(searchLower)
      );
      
      if (!(inSubject || inContent || inParticipants)) {
        return false;
      }
    }
    
    // Filter by label
    if (labelIds && labelIds.length > 0) {
      if (!thread.labelIds || !thread.labelIds.some(id => labelIds.includes(id))) {
        return false;
      }
    }
    
    return true;
  });
  
  // Sort by date (newest first)
  filteredThreads = filteredThreads.sort((a, b) => 
    new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()
  );
  
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedItems = filteredThreads.slice(start, end);
  
  return {
    items: paginatedItems,
    total: filteredThreads.length,
    page,
    pageSize,
    hasMore: end < filteredThreads.length,
  };
} 