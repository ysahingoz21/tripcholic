export type JwtAccessTokenPayload = {
  sub: string;
  email: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
};
