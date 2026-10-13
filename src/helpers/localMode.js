// Local-mode surface for upstream main-process code (see src/components/notes/localMode.ts
// for the renderer side). The fork has no account layer: one fixed local scope for
// connector logins/receipts, and an account-scope binding that never binds.
const LOCAL_ACCOUNT_SCOPE = { accountId: "local", authGeneration: 0 };

const accountScopeBinding = {
  read: () => null,
  clear: () => {},
  persist: () => {},
  resolveActiveAccountScope: () => null,
};

module.exports = { LOCAL_ACCOUNT_SCOPE, accountScopeBinding };
