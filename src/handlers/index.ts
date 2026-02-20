export { handleAuthorize, handleLoginPage, handleLoginSubmit } from "./auth.ts";
export { handleDiscovery, handleJWKS } from "./discovery.ts";
export {
  handleMockClients,
  handleMockHealth,
  handleMockOneTapCodes,
  handleMockUsers,
} from "./mock.ts";
export { handleEndSession, handleIntrospect, handleRevoke } from "./session.ts";
export { handleToken } from "./token.ts";
export { handleUserInfo, handleUserPhoto } from "./userinfo.ts";
