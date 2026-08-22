/**
 * 역할 기반 접근 제어(RBAC) 설정
 */
export const roleConfig = {
  teamGroupId: 'cb77a63e-8b14-441b-ba7b-956a47cfb2ae',

  roles: {
    admin: 'admin',
    member: 'member',
    guest: 'guest',
    none: 'none'
  },

  permissions: {
    admin: [
      'read-all',
      'create',
      'update-all',
      'delete-all',
      'manage-visibility',
      'manage-members',
      'manage-guests',
      'view-usage',
      'delete-user-bookmarks'
    ],
    member: [
      'read-public',
      'create-own',
      'update-own',
      'delete-own'
    ],
    guest: [
      'read-public',
      'create-own',
      'update-own',
      'delete-own'
    ]
  },

  // Guest → Member 승격 금지
  disallowedTransitions: [
    { from: 'guest', to: 'member' }
  ]
};
