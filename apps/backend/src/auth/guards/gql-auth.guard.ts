// GqlAuthGuard is an alias for JwtAuthGuard — it already handles both
// HTTP and GraphQL execution contexts via GqlExecutionContext internally.
export { JwtAuthGuard as GqlAuthGuard } from './jwt-auth.guard';
