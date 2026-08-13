export type User = {
  id: number;
  email: string;
  displayName: string;
  createdAt?: string;
  emailVerified?: boolean;
};

export type RegisterResult = {
  message: string;
  email?: string;
  emailSent: boolean;
  autoVerified?: boolean;
  devLink?: string;
};
