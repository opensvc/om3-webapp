import {UserManager, WebStorageStateStore} from 'oidc-client-ts';

const oidcUserManager = (config) => new UserManager({
    ...config,
    userStore: new WebStorageStateStore({store: window.localStorage}),
});

export default oidcUserManager;