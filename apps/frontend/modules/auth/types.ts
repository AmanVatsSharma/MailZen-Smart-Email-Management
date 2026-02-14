export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
};

export type AuthNavigationState = {
  requiresAliasSetup?: boolean | null;
  nextStep?: string | null;
};
