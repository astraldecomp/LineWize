// max connection we will store before triggering an immediate upload
const MAX_STORED_CONNECTION_ITEMS = 10000;
// minimum time between connection uploads
const CONNECTION_UPLOAD_INTERVAL_MILLISECONDS = 300000;

class Connections {
    constructor(verdict_store) {
        resetStorage();

        this.lastReport = Date.now();
        this.cachedConnections = {};
        this.storedConnectionCount = 0;
        this.cachedTabs = {};

        chrome.webRequest.onSendHeaders.addListener(async (details) => {
                if (this.shouldProcessConnectionObject(details)) {
                    this.updateConnectionObject(details, false)
                }
            },
            {urls: ["<all_urls>"]},
            ["requestHeaders"]);

        chrome.webRequest.onBeforeRequest.addListener(async (details) => {
                if (this.shouldProcessConnectionObject(details) && !filtering.shouldCheckFilter(details)) {
                    this.updateConnectionObject(details, false)
                }
            },
            {urls: ["<all_urls>"]},
            ["requestBody"]);

        chrome.webRequest.onHeadersReceived.addListener(async (details) => {
                if (details.requestId && this.shouldProcessConnectionObject(details)) {
                    this.updateConnectionObject(details, false)
                }
            },
            {urls: ["<all_urls>"]},
            ["responseHeaders"]);
            
        /*
            On request completion, process connection object and store it in storage.local
        */
        chrome.webRequest.onCompleted.addListener(
            async (details) => {

                let reportConnections = this.shouldProcessConnectionObject(details);
                if (details["fromCache"] === false && reportConnections) {
                    // save set to true in updateConnectionObject to save the object to storage
                    await this.updateConnectionObject(details, true);
                }
                // only allow data uploads if connection reporting is enabled
                if (reportConnections){
                    this.uploadData();
                }
            },{urls: ["<all_urls>"]}
        );

        // Upload a fake connection object when the tab changes to a youtube.com/watch url
        // as YouTube video changes do not trigger a /watch network request.
        // This ensures that videos will show up in SM
        chrome.tabs.onUpdated.addListener((id, change, tab) => {
            if (change.url) {
                // match to youtube url format
                if (tab.url.includes("youtube.com/watch?v=")
                    && this.cachedTabs[id] != tab.url
                ) {
                    this.createFakeYoutubeConnection(id, tab.url);
                }

                this.cachedTabs[id] = tab.url
            }
        });

        chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
            if (tabId in this.cachedTabs) {
                delete this.cachedTabs[tabId];
            }
        })
    }

    /*
        This function analyses a connection object and determines if it needs to be 
        processed.

        Some connections are just noise that we do not need to worry about (e.g. verdict requests do not need to be
            reported)
    */
    shouldProcessConnectionObject(details) {
        return details
            && (config.isConnectionReportingEnabled())
            && !details.url.toLowerCase().startsWith("chrome")
            && extractHostname(details.url) !== "localhost"
            && config.userFound
            && details.url.toLowerCase().indexOf("linewize.net") === -1
            && !(details.initiator && details.initiator.toLowerCase().startsWith("chrome"))
            
            // cached connection are not reported
            && (!details["fromCache"] || details["fromCache"] === false)

            // the webRequest api will sometimes intercept chrome-extension requests, so we must ignore them
            && (!details["initiator"] || details["initiator"] !== "chrome-extension")
    }

    getBlankConnectionObject(requestId) {
        return {
            id: generateUUID(),
            url: "",
            app_filtering_denied: false,
            bypass_code: "",
            bypass_expiry_time: 0,
            categoryId: "",
            destIp: "0.0.0.0",
            destPort: 0,
            download: 0,
            final_connection_object: true,
            hwAddress: "",
            httpHost: "0",
            http_request_uris: [],
            htmlTitle: undefined,
            lifetime: 0,
            packets: 1,
            sourceIp: config.local_ip,
            subCategoryId: "",
            tag: "",
            time: 0,
            upload: 1, // This might seem weird, but its needed otherwise connections get filtered by the cloud
            user: config.getCurrentUserInfo().user,
            verdict_application_rule: "",
            noise: false,
            reportingType: "extension",
            extensionConnection: false,
            debug__chrome_verdict_issued: false,
            debug__chrome_requestId: requestId,
        };
    }

    /*
        Get an existing connection object from the in-memory cache if there is one,
        otherwise create a new blank connection object and return it.
    */
    getConnectionObject(requestId) {
        if (this.cachedConnections.hasOwnProperty(requestId)) {
            return this.cachedConnections[requestId];
        }
        else {
            return this.getBlankConnectionObject(requestId);
        }
    }

    /*
        Store a connection object in chrome.storage.local.
        If a value already exists in storage, merge the two together.
    */
    saveConnectionToStorage(requestId, connectionObject, callback) {
        chrome.storage.local.get([requestId], (result) => {
            let connections = {};
            if (Object.keys(result).length === 0) {
                connections[requestId] = connectionObject
                chrome.storage.local.set(connections, callback);
            } else {
                this.mergeConnectionData(connectionObject, result[requestId]).then(newConnection => {
                    connections[requestId] = newConnection;
                    chrome.storage.local.set(connections, callback);
                });
            }
        })
    }

    removeConnection(requestId) {
        chrome.storage.local.remove(requestId);
        if (requestId in this.cachedConnections) {
            delete this.cachedConnections[requestId];
        }
    }

    /*
        Take an existing connection object, and update it with the values contained in 'details'
    */
    async mergeConnectionData(connectionObject, details) {
        let domain = extractHostname(details.url);
        connectionObject.url = details.url
        connectionObject.httpHost = domain;
        connectionObject.user = config.getCurrentUserInfo().user;
        connectionObject.time = nowInSeconds();
        connectionObject.lifetime = 0;
        connectionObject.packets = 1;
        connectionObject.protocol = 6;
        connectionObject.hwAddress = "";
        connectionObject.agent = `chrome-extension-${chrome.runtime.getManifest().version}`;
        connectionObject.agent_inside_network = config.inside_device_network;
        connectionObject.final_connection_object = true;
        connectionObject.destPort = extractPort(details.url);
        connectionObject = await this.updateConnectionObjectWithVerdict(connectionObject, details);
        
        let requestUri = extractRequestUri(details.url);
        if (!connectionObject.http_request_uris) {
            connectionObject["http_request_uris"] = []
        }
        if (connectionObject.http_request_uris.indexOf(requestUri) < 0) {
            connectionObject.http_request_uris.push(requestUri)
        }
        const searchQuery = filtering.getYoutubeSearchQuery(details);
        if (searchQuery) {
            connectionObject.http_request_uris.push(
                `/results?search_query=${encodeURIComponent(searchQuery)}`
            );
        }
        connectionObject.sourceIp = config.local_ip;
        if (details.ip) connectionObject.destIp = details.ip;

        if (details.requestHeaders) {
            for (let header of details.requestHeaders) {
                connectionObject.upload += header.name.length;
                connectionObject.upload += header.value.length;
            }
        }
        if (details.responseHeaders) {
            for (let header of details.responseHeaders) {
                connectionObject.download += header.name.length;
                connectionObject.download += header.value.length;

                if (header.name.toLowerCase() === "content-length") {
                    if (details.method.toLowerCase() === "get") {
                        if (!connectionObject.download) {
                            connectionObject.download = Number(header.value);
                        } else connectionObject.download += Number(header.value)
                    } else {
                        if (!connectionObject.upload) {
                            connectionObject.upload = Number(header.value);
                        } else connectionObject.upload += Number(header.value)
                    }
                }
            }
            connectionObject.destIp = details.ip;
        }
        if (details.requestBody) {
            if (!connectionObject.upload) {
                connectionObject.upload = Number(roughSizeOfObject(details.requestBody));
            } else connectionObject.upload += Number(roughSizeOfObject(details.requestBody));
        }
        if (details.tabId && details.tabId !== -1) {
            chrome.tabs.get(details.tabId, tab => {
                if (!chrome.runtime.lastError && tab.status === "complete") {
                    connectionObject.htmlTitle = tab.title
                }
            })
        }
        return connectionObject
    }

    /*
        Update connection objects with 'details'
        If save is set to true, then this connection object will be saved to chrome.storage.local.
    */
    async updateConnectionObject(details, save) {
        if (details.url && this.shouldProcessConnectionObject(details)) {
            let requestId = details.requestId;
            let connectionObject = this.getConnectionObject(requestId);

            connectionObject = await this.mergeConnectionData(connectionObject, details)
            
            // we don't want to save to localStorage every update, only when the request is complete.
            if (save) {
                this.saveConnectionToStorage(requestId, connectionObject, () => {
                    this.storedConnectionCount++;
                    // delete the cached connection once we are done with it
                    delete this.cachedConnections[requestId];
                });
            } else {
                this.cachedConnections[requestId] = connectionObject
            }
        }
    }

    /*
        Add verdict information (contained in 'details') to a connection object.
    */
    async updateConnectionObjectWithVerdict(connectionObject, details) {
        let verdict = verdict_response_store.getVerdictResponse(details.requestId, details.url);
        if (!verdict) {
            let search_query = filtering.getYoutubeSearchQuery(details);
            verdict = await filtering.getVerdictPromise(details.url, true, -1, search_query);
            verdict_response_store.setVerdictResponse(details.requestId, details.url, verdict);
        }

        if (verdict.verdict === 0) {
            connectionObject.debug__chrome_verdict_issued = true;
            connectionObject.app_filtering_denied = true;

        } else if (verdict.verdict === 1) {
            connectionObject.debug__chrome_verdict_issued = true;
            connectionObject.app_filtering_denied = false;
        }

        connectionObject.verdict_application_rule = verdict.rule ? verdict.rule.id : "";
        connectionObject.verdict_application_rule = verdict.zoom ? verdict.zoom.group : connectionObject.verdict_application_rule;
        if (verdict.bypass) {
            connectionObject.bypass_code = verdict.bypass.code;
            connectionObject.bypass_expiry_time = verdict.bypass.expiry_time;
        }

        if (verdict.signatures) {
            connectionObject.categoryId = verdict.signatures.category;
            connectionObject.subCategoryId = verdict.signatures.subCategory;
            connectionObject.tag = verdict.signatures.signature;
            if (verdict.signatures.noise) {
                connectionObject.noise = verdict.signatures.noise;
            }
        }
        return connectionObject;
    }

    /*
        Check if we need to upload connection data to stats-api-dispatcher.

        We keep track of the number of connections we have stored in local storage (so we don't need to make an
        expensive query to chrome.storage.local each time). If this value exceeds MAX_STORED_CONNECTION_ITEMS then
        we immediately upload.

        Otherwise, we will upload at a timed interval equal to CONNECTION_UPLOAD_INTERVAL_MILLISECONDS.
    */
    uploadData() {
        let timeIntervalChecked = this.lastReport < Date.now() - CONNECTION_UPLOAD_INTERVAL_MILLISECONDS;
        if (this.storedConnectionCount > MAX_STORED_CONNECTION_ITEMS || timeIntervalChecked) {
            
            this.lastReport = Date.now();

            // get all connection items from storage.local
            chrome.storage.local.get(null, (r) => {
                logging__message("Upload Data Called", Object.keys(r).length); 

                // do not upload if we have no items to upload, or we are missing vital config items
                if (config.local_ip && config.active_region && config.device_id && Object.keys(r).length > 0) {
                    
                    this.storedConnectionCount = 0;
                    logging__message("Uploading Data", config.local_ip, config.active_region, config.device_id);
                    let xhr = new XMLHttpRequest();
                    xhr.timeout = 0;
                    let connectionItems = [];
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState === 4) {
                            if (xhr.status === 200) {
                                logging__message("Upload Successful", connectionItems.length, xhr)
                            } else {
                                logging__warning("Upload Failed", xhr)
                            }
                        }
                    };

                    for (let requestId in r) {
                        let connectionObject = r[requestId];
                        connectionItems.push(connectionObject);
                        chrome.storage.local.remove(requestId);
                    }

                    let data = {
                        items: connectionItems
                    };

                    xhr.open("POST", "https://stats-xlb." + config.active_region + ".linewize.net/" + config.device_id + "/-/extension", true);

                    xhr.setRequestHeader("Content-Type", "application/json");
                    xhr.setRequestHeader("Accept", "application/json");
                    
                    let jsonData = JSON.stringify(data);
                    xhr.send(jsonData);                
                }
            })
        }
    }

    createFakeYoutubeConnection(tabId, url) {
        const connection = this.getBlankConnectionObject(null);
        connection.url = url;
        connection.requestId = connection.id;
        // update and save the connection object.
        this.updateConnectionObject(connection, true);
    }
}

