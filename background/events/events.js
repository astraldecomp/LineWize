class Updater {
    constructor() {
        this.REAUTH_ALLOWED_TIMER_SECONDS = 600 // 10 minutes

        this.messaging = new Messaging();
        this.chat = new Chat();
        this.eventService = undefined;
        this.pendingEventSource = false;
        this.lastEventMessage = 0;
        this.eventServiceRetryTimeoutSeconds = 1;
        this.eventServiceRetriedWithExistingAuth = false;
        this.eventServiceRetriedWithNewAuth = false;
        this.lastChatMessage = null;
        this.reauthTimeoutId = undefined;
        this.lastAuthAttemptDate = null;
    }

    getReauthAllowedTimer() {
        return config.reauth_allowed_timer_seconds || this.REAUTH_ALLOWED_TIMER_SECONDS;
    }

    // mitigates a self ddos if event-service goes down - stops all clients trying to reauth at the same time
    getReauthJitterMs() {
        return getRandomInt(0, 90000); // between 0 and 90 seconds
    }

    handle_event_policy_update(event) {
        filtering.reset__verdict_cache();
        configUpdate();
        tabs.check_tabs_for_rule_violations(this.messaging);
    }

    handle_event_message(event) {
        let data = JSON.parse(event.data);
        let ts = data.header.timestampEpochMs;
        const msg = data.msg;
        this.messaging.print_message(msg, ts);
    }

    handle_event_open_tab(event) {
        let data = JSON.parse(event.data);
        let messageContent = data.url;

        if (messageContent.toLowerCase().startsWith("http://") || messageContent.toLowerCase().startsWith("https://")) {
            chrome.tabs.create({url: messageContent});
        } else {
            chrome.tabs.create({url: "http://" + messageContent});
        }
    }
    
    /**
     * Prints a message once the the specified tab
     * has been closed.
     * @param {*} event 
     * @param {*} tab 
     */
    post_close_tab_callback(event, tab) {
        let data = JSON.parse(event.data);
        let ts = data.header.timestampEpochMs;

        this.messaging.print_close_tab_message(
            tab["favIconUrl"],
            ts,
        );
    }

    /**
     * Handle close tab event
     * @param {*} event
     */
    handle_event_close_tab(event) {
        let data = JSON.parse(event.data);

        let tabId = data.tabId;
        let windowId = data.windowId;
        if (tabId && windowId) {
            let parsedtabId = parseInt(tabId);
            // get the list of all tabs to check if we are closing the last tab
            chrome.tabs.query({}, (allTabs) => {
                chrome.tabs.get(parsedtabId, tab => {
                    if (chrome.runtime.lastError) {
                        logging__error("Error closing tab:", chrome.runtime.lastError.message);    
                    } else {
                        tabs.close_tab(parsedtabId, allTabs, () => this.post_close_tab_callback(event, tab));
                    }
                })
            });
        } else {
            logging__error("Error parsing tabId and windowId", tabId, windowId);
        }
    }

    handle_event_p2p_init(event) {
        const data = JSON.parse(event.data)  
        const { channel, signalHost, signalToken, signalExpiryEpochSeconds, remotePeerId, ice } = data
        p2pManager.initSignaler(
            signalToken,
            channel,
            remotePeerId,
        );
        p2pManager.setIce(ice)
    }

    /**
     * Handle new chat arrive event
     * @param {*} event
     */
     handle_event_new_chat_arrive(event) {
         // Show bubble if chat ui is closed
         // or load the new chat if the chat ui is open
         chrome.runtime.sendMessage({ type: 'NEW_MESSAGE', data: event });
         // Don't open chat window if chat is not enabled
         if (event.sender.id !== config.getCurrentUserInfo().user && config.getClassroomChatStatus()) {
             this.chat.show_chat_ui(event.classroomId);
         }
       
     }

    disconnectEventService = () => {
        logging__message("Disconnecting from Event Service");
        if (this.eventService) {
            this.eventService.close();
        }
        this.eventService = undefined;
        this.pendingEventSource = false;
    };

    logReceivedEvent(event) {
        this.eventServiceRetryTimeoutSeconds = 1;
        this.lastEventMessage = Date.now() / 1000;
        logging__debug("Event Message Received", event);
    }

    connectToEventService = () => {
        logging__message("Connecting to v2 Event Service");
        let self = this;
        let device = config.getDeviceId();
        let user = config.getCurrentUserInfo().user;

        let event_types;
        if (config.is_teacher) {
            event_types = "CONFIG_UPDATE";
        } else {
            event_types = "CONFIG_UPDATE,OPEN_TAB,CLOSE_TAB,MESSAGE,CLASS_STARTED,POLICY_UPDATE,INIT_P2P";
        }

        const eventServiceUrlv2 = `${config.eventServiceUrl}/events/v2/appliance/${device}/recipient/${user}?events=${event_types}`;

        if (self.eventService === undefined && !self.pendingEventSource) {
            self.pendingEventSource = true;
            self.eventService = new EventSource(eventServiceUrlv2, {withCredentials: true});

            self.eventService.onerror = async function (error) {
                logging__error("ERROR WITH EVENT SOURCE", error);
                chrome.cookies.get({ name: "authorization", url: "https://linewize.net" }, (cookie) => {
                    self.disconnectEventService();
                    if (!self.eventServiceRetriedWithExistingAuth && cookie) {
                        //Jitter the first reconnect attempt so we're not swamping ESS
                        const jitterSeconds = getRandomInt(0, 5)
                        console.log(`Retrying with existing auth in ${jitterSeconds} seconds`)
                        window.setTimeout(self._retryEventServiceWithExistingAuth.bind(self), jitterSeconds*1000)
                    } else if (!self.eventServiceRetriedWithNewAuth) {
                        // Jitter the first new auth attempt of the day.
                        let jitterSeconds = 0
                        const date = new Date()
                        const dateString = date.toDateString()
                        if (!self.lastAuthAttemptDate || self.lastAuthAttemptDate !== dateString) {
                            jitterSeconds = getRandomInt(0, 5)
                        }
                        self.lastAuthAttemptDate = dateString
                        console.log(`Retrying with new auth in ${jitterSeconds} seconds`)
                        window.setTimeout(self._retryEventServiceWithNewAuth.bind(self), jitterSeconds*1000)
                    } else {
                        self._retryEventServiceAfterTimeout()
                    }
                })
            }

            self.eventService.onopen = function () {
                console.log("Connected to event-service")
                self.eventServiceRetriedWithExistingAuth = false;
                self.eventServiceRetriedWithNewAuth = false;
                clearTimeout(this.reauthTimeoutId);
                self.eventServiceRetryTimeoutSeconds = 1;
            }

            self.eventService.addEventListener('CONFIG_UPDATE', function(event) {
                self.logReceivedEvent(event);
                configUpdate();                
            }, false);
            
            self.eventService.addEventListener('OPEN_TAB', function(event) {
                self.logReceivedEvent(event);

                if (config.isClassroomEnabled()) {
                    self.handle_event_open_tab(event);
                }
            }, false);
            
            self.eventService.addEventListener('CLOSE_TAB', function(event) {
                self.logReceivedEvent(event);

                if(config.isClassroomEnabled()){
                    self.handle_event_close_tab(event);
                }
            }, false);
            
            self.eventService.addEventListener('MESSAGE', function(event) {
                self.logReceivedEvent(event);

                let eventData;

                try {
                    eventData = JSON.parse(event.data)
                } catch (err) {
                    // do nothing
                }
                if (!eventData || (eventData.threadKey && config.isClassroomEnabled())) {
                    self.handle_event_new_chat_arrive(eventData);
                    self.lastChatMessage = eventData;
                } else if (config.isClassroomEnabled()) {
                    self.handle_event_message(event);
                }
                
            }, false);
            
            self.eventService.addEventListener('CLASS_STARTED', function(event) {
                self.logReceivedEvent(event);

                if(config.isClassroomEnabled()){
                    self.handle_event_policy_update(event);
                }
            }, false);
            
            self.eventService.addEventListener('POLICY_UPDATE', function(event) {
                self.logReceivedEvent(event);

                if(config.isClassroomEnabled()){
                    self.handle_event_policy_update(event);
                }                
            }, false);

            self.eventService.addEventListener('INIT_P2P', function(event) {
                self.logReceivedEvent(event);

                let data = JSON.parse(event.data)
                
                if(data.peerAgentId === config.chromeId && config.isClassroomEnabled()) {
                    self.handle_event_p2p_init(event);
                }
            }, false);

            self.pendingEventSource = false;
        }
    };

    _retryEventServiceWithExistingAuth = async () => {
        const self = this;
        try {
            self.eventServiceRetriedWithExistingAuth = true;
            self.connectToEventService();
        } catch (error) {
            self._retryEventServiceAfterTimeout()    
        }
    }

    _retryEventServiceWithNewAuth = async () => {
        const self = this;
        try {
            await authenticate.autoAuth();
            this.reauthTimeoutId = setTimeout(() => {
                self.eventServiceRetriedWithNewAuth = false;
            }, self.getReauthAllowedTimer()*1000 + self.getReauthJitterMs())
            
            self.eventServiceRetriedWithNewAuth = true;
            self.connectToEventService();
        }
        catch (error) {
            console.error('Failed to authenticate before retrying to connect to event-service, triggering events retry again after timeout')
            self._retryEventServiceAfterTimeout()    
        }
    }

    _retryEventServiceAfterTimeout = () => {
        const self = this;
        logging__warning("v2 Event service connect error; sleeping for " + self.eventServiceRetryTimeoutSeconds + "seconds");
        self.eventServiceRetryTimeoutSeconds *= 2;
        if (self.eventServiceRetryTimeoutSeconds >= 64) {
            self.eventServiceRetryTimeoutSeconds = 64;
        }

        window.setTimeout(self.connectToEventService.bind(self), (self.eventServiceRetryTimeoutSeconds)*1000);
    }

    updateChatConfigInfo = () => {
        if (!config.getClassroomChatStatus()) {
            return
        }
        const userInfo = config.getCurrentUserInfo();
        const baseUrl = config.getChatBaseUrl();
        const applianceId = config.getDeviceId();

        this.chat.update_baseUrl_and_user(baseUrl, userInfo.user, applianceId);
    }
}
