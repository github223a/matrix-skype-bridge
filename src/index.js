const {Bridge} = require('matrix-appservice-bridge');
const path = require('path');

const log = require('./modules/log')(module);
const config = require('./config');
const {skypeEventHandler, skypeErrorHandler} = require('./lib/skype-handler');
const matrixEventHandler = require('./lib/matrix-handler');
const skypeConnect = require('./lib/skype-lib/connect');
const Puppet = require('./puppet');

const puppet = new Puppet(path.join(__dirname, './config.json'));

module.exports = async function app() {
    log.info('starting matrix client');
    await puppet.startClient();
    const skypeClient = await skypeConnect(config.skype);

    const handleMatrixEvent = data => matrixEventHandler({puppet, skypeClient, bridge: this.bridge})(data);
    const controller = {
        onUserQuery: queriedUser => {
            log.info('got user query', queriedUser);
            // auto provision users w no additional data
            return {};
        },
        onEvent: handleMatrixEvent,
        onAliasQuery: () => {
            log.info('on alias query');
        },
        thirdPartyLookup: {
            protocols: [config.servicePrefix],
            getProtocol: () => log.info('get proto'),
            getLocation: () => log.info('get loc'),
            getUser: () => log.info('get user'),
        },
    };

    this.bridge = new Bridge({...config.bridge, controller});

    await this.bridge.run(config.port, config);

    skypeClient.on('event', skypeEventHandler({bridge: this.bridge, puppet, skypeClient}));
    skypeClient.on('error', skypeErrorHandler);
};
