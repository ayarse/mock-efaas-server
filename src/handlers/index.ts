export { handleAuthorize, handleLoginPage, handleLoginSubmit } from "./auth.ts";
export { handleDiscovery, handleJWKS } from "./discovery.ts";
export {
  handleMockClients,
  handleMockDeleteClient,
  handleMockDeleteUser,
  handleMockGetSettings,
  handleMockHealth,
  handleMockListClients,
  handleMockOneTapCodes,
  handleMockReset,
  handleMockSaveUser,
  handleMockUpdateSettings,
  handleMockUsers,
} from "./mock.ts";
export {
  handleCheckSession,
  handleEndSession,
  handleIntrospect,
  handleRevoke,
} from "./session.ts";
export { handleToken } from "./token.ts";
export { handleUserInfo, handleUserPhoto } from "./userinfo.ts";
