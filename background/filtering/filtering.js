class Filtering {
    constructor() {
        let self = this;
        self.cache = {};

        self.verdictQueue = {}
        self.fallback_until = 0;
        self.noUserFallback = false;
        self.cacheForYoutubeQuery = new TemporaryFixedSizeCache(20);

        self.requestTimeSamples = arrayQueue(10);
        chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
            let url = sender.url;
            let response = "ok"
            let ruleInfo = "?user=" + config.getCurrentUserInfo()["user"] +
                "&url=" + extractHostname(url) + "&deviceid=" + config.device_id + "&ip=" + config.local_ip + "&cid=" + config.chromeId;
            let redirectUrl = config.getBlockpageUrl() + ruleInfo

            /* delegatedBlockSite message is received when a verdict request fails and safeguard is delegated to, 
               this is the message response from safeguard.
               Must stay first and before any verdict call to avoid possibility of entering a positive feedback loop of failed verdict requests */
            if (request.message === "delegatedBlockSite") {
                logging__message("Delegated safeguard action is block site");
                sendResponse({
                    message: "redirect",
                    redirectUrl: chrome.runtime.getURL("background/filtering/default-blocked.html")
                });
            }
            else if ((self.shouldCheckFilter(sender)) && (request.message === "checkRequest")) {
                // Confirm the site loaded should be allowed
                let search_query = self.getYoutubeSearchQuery(request);
                let verdict = self.get__verdict(request.url, false, -1, search_query, false);
                if (verdict["verdict"] === 0) {
                    logging__message("Blocked site bypass detected, blocking again.");
                    response = "redirect";
                }
                sendResponse({
                    message: response,
                    redirectUrl: redirectUrl
                });
            }
            // Fallback mode - give the all clear to block if needed
            else if ((self.isFallback()) && (request.message === "blockSite")) {
                logging__message("Fallback system blocking and redirecting to blocked page");
                response = "redirect";

                sendResponse({
                    message: response,
                    redirectUrl: chrome.runtime.getURL("background/filtering/default-blocked.html")
                });
            }
        });

        chrome.webRequest.onBeforeRedirect.addListener(
            function (details) {
                logging__message("Redirect caught", details.requestId, details.url, details.redirectUrl);
                verdict_response_store.removeVerdictResponse(details.requestId);
                connections.removeConnection(details.requestId);
            }, {
            urls: ["<all_urls>"]
        });
        chrome.webRequest.onBeforeRequest.addListener(
            (details) => {
                if (self.isGoogleMapsVerdictBypass(details)) {
                    return
                }

                if (self.shouldCheckFilter(details)) {
                    stats.incrementStats("Filtering", "verdictRequests", 1);
                    let verdictResponse = verdict_response_store.getVerdictResponse(details.requestId, details.url);

                    if (!verdictResponse) {
                        const search_query = self.getYoutubeSearchQuery(details);
                        const domain = extractHostname(details.url);
                        const path = encodeURIComponent(extractURLPath(details.url));
                        const excludeCache = this.isGoogleSearchPathExclusion(domain, path);

                        // check if we can skip getting a verdict from the server
                        const earlyVerdict = this.getEarlyVerdict(domain, details.url, excludeCache, false);

                        if (!earlyVerdict) {
                            // non-initiator verdict requests are handled asynchronously in the background (if asyncHandling is on)
                            if (details.initiator != undefined && details.initiator != ""
                                && config.asyncVerdictHandlingEnabled
                                && details.type !== "image"
                                && details.type !== "media"
                                && details.type !== "main_frame"
                            ) {
                                // create a queue per tab for verdicts
                                if (details.tabId in this.verdictQueue) {
                                    this.verdictQueue[details.tabId].enqueue(details);
                                }
                                else {
                                    this.verdictQueue[details.tabId] = new Queue();
                                    this.verdictQueue[details.tabId].enqueue(details);
                                }

                                // need to redirect safe search here, no verdict request required so we might as well do it straight away!
                                const safeSearchRedirect = self.enforceGoogleSafeSearchIfRequired(details.url) || self.enforceBingSafeSearchIfRequired(details.url);
                                if (safeSearchRedirect) {
                                    return {
                                        redirectUrl: safeSearchRedirect
                                    };
                                }
                                return;
                            }

                            // get verdict response via api - skipCache set to true as we have already checked the cache when we got earlyVerdict
                            verdictResponse = self.get__verdict(details.url, false, details.tabId, search_query, true);
                            verdict_response_store.setVerdictResponse(details.requestId, details.url, verdictResponse);
                        } else {
                            if (!excludeCache && earlyVerdict.ttl > 0) {
                                this.cache[domain] = earlyVerdict;
                            }
                            verdictResponse = earlyVerdict;
                        }
                    }

                    // if the verdict is 0, save the details to local storage
                    const saveConnection = verdictResponse.verdict === 0
                    connections.updateConnectionObject(details, saveConnection);

                    stats.setStats("Filtering", "cacheSize", Object.keys(self.cache).length);
                    if (verdictResponse.verdict === 0) {
                        let redirectUri = verdictResponse.redirect_uri;

                        logging__warning("redirect found from verdict!", redirectUri);

                        // Do not modify redirect returned by verdict as it is case insensitive
                        let redirectUriLower = redirectUri.toLowerCase();
                        if (!(redirectUriLower.startsWith("http://") || redirectUriLower.startsWith("https://"))) {
                            redirectUri = "http://" + redirectUri;
                        }
                        self.redirectRequest = details.requestId;
                        if (!verdictResponse.rule || !verdictResponse.rule.redirect) {
                            // The blocked page requires the cid for bypass code functionality
                            // verdictResponse will not hold "rule" if the redirect comes from a class room policy
                            // the only time we dont want the cid is when there is a redirect within the "rule" value, hence this if statement
                            redirectUri += "&cid=" + config.chromeId;
                        }
                        return {
                            redirectUrl: redirectUri
                        };
                    }
                    else {
                        const safeSearchRedirect = self.enforceGoogleSafeSearchIfRequired(details.url) || self.enforceBingSafeSearchIfRequired(details.url);
                        if (safeSearchRedirect) {
                            return {
                                redirectUrl: safeSearchRedirect
                            };
                        }
                    }
                }
                else if (this.isFallback()) {
                    const safeSearchRedirect = self.enforceGoogleSafeSearchIfRequired(details.url) || self.enforceBingSafeSearchIfRequired(details.url);
                    if (safeSearchRedirect) {
                        connections.removeConnection(details.requestId);
                        return {
                            redirectUrl: safeSearchRedirect
                        };
                    }
                }
            }, {
            urls: ["<all_urls>"]
        },
            ["blocking", "requestBody"]
        );

        /**
         * Intercept the request to check if youtube safe search is applicable.
         */
        chrome.webRequest.onBeforeSendHeaders.addListener(
            function (details) {
                const youtubeSafeSearchMode = config.getYoutubeSafeSearchMode();
                if (youtubeSafeSearchMode) {
                    const safeSearcHeader = { "name": "YouTube-Restrict", "value": youtubeSafeSearchMode };
                    details.requestHeaders.push(safeSearcHeader);
                    return { requestHeaders: details.requestHeaders };
                }

            }, {
            urls: ["*://*.youtube.com/*", "*://youtubei.googleapis.com/*", "*://youtube.googleapis.com/*", "*://www.youtube-nocookie.com/*"]
        },
            ['blocking', 'requestHeaders']
        );

        /**
         *  Dynamic header injection mechanism 
         */
        chrome.webRequest.onBeforeSendHeaders.addListener(
            function (details) {
                // Get the verdict response from the cache
                let verdictResponse = verdict_response_store.getVerdictResponse(details.requestId, details.url);

                if (verdictResponse != null
                    && verdictResponse.custom_headers != null
                    && verdictResponse.custom_headers.upsert != null) {

                    let headersToInject = verdictResponse.custom_headers.upsert;

                    for (let headerToInject of headersToInject) {
                        const lname = headerToInject.name.toLowerCase();

                        // check if an existing header should be modified
                        const index =
                            details.requestHeaders.findIndex(
                                header => header.name.toLowerCase() == lname);

                        if (index != -1) {
                            details.requestHeaders[index].value = headerToInject.value;
                        } else {
                            details.requestHeaders.push({
                                name: headerToInject.name,
                                value: headerToInject.value
                            });
                        }

                        logging__debug(
                            "HTTP header: [" + headerToInject.name + ": "
                            + headerToInject.value + "] has been injected");
                    }

                    return { requestHeaders: details.requestHeaders };
                }

            }, {
            urls: ["<all_urls>"]
        },
            ['blocking', 'requestHeaders']
        );

        chrome.webRequest.onBeforeRequest.addListener(details => {
            if (!config.inside_device_network) {
                if (!config.getAllowInsecureChrome() && !config.getCurrentUserInfo()["token"]) {
                    let tabId = undefined;
                    chrome.tabs.query({}, tabs => {
                        for (let tab of tabs) {
                            if (tab.url === details.url) {
                                tabId = tab.id
                            }
                        }
                    });
                    chrome.identity.getAuthToken({
                        interactive: true
                    }, token => {
                        config.currentUserInfo["token"] = token;
                        let url = self.redirect_mylinewize();

                        chrome.tabs.update(tabId, {
                            url: url
                        });
                    });
                    return {
                        redirectUrl: "about:blank"
                    };
                } else {
                    let url = self.redirect_mylinewize();
                    return {
                        redirectUrl: url
                    };
                }
            }
        }, {
            urls: ["*://my.linewize.net/*"]
        }, ["blocking"]);


        setInterval(this.handleVerdictQueue, 1000)

        this.handleVerdictQueue = this.handleVerdictQueue.bind(self)
        this.apiGetVerdictPromise = this.apiGetVerdictPromise.bind(self)
    }

    /*
        Handle queued verdict requests for each tab.
    */
    handleVerdictQueue = () => {
        for (const [key, value] of Object.entries(this.verdictQueue)) {
            const queue = value;

            if (queue.getLength() === 0) {
                continue;
            }

            for (let i = 0; i < Math.min(queue.getLength(), 2); i++) {
                const details = queue.dequeue();
                let search_query = this.getYoutubeSearchQuery(details);

                this.getVerdictPromise(details.url, false, details.tabId, search_query).then(verdictResponse => {

                    verdict_response_store.setVerdictResponse(details.requestId, details.url, verdictResponse);

                    // if the verdict is 0, save the details to local storage
                    const saveConnection = verdictResponse.verdict === 0
                    connections.updateConnectionObject(details, saveConnection);

                    stats.setStats("Filtering", "cacheSize", Object.keys(this.cache).length);

                    if (verdictResponse.verdict === 0) {
                        let redirectUri = verdictResponse.redirect_uri;
                        logging__warning("redirect found from verdict!", redirectUri);
                        // Do not modify redirect returned by verdict as it is case insensitive
                        let redirectUriLower = redirectUri.toLowerCase();
                        if (!(redirectUriLower.startsWith("http://") || redirectUriLower.startsWith("https://"))) {
                            redirectUri = "http://" + redirectUri;
                        }
                        this.redirectRequest = details.requestId;
                        if (!verdictResponse.rule || !verdictResponse.rule.redirect) {
                            // The blocked page requires the cid for bypass code functionality
                            // verdictResponse will not hold "rule" if the redirect comes from a class room policy
                            // the only time we dont want the cid is when there is a redirect within the "rule" value, hence this if statement
                            redirectUri += "&cid=" + config.chromeId;
                        }

                        if (!verdictResponse.signatures?.noise && verdictResponse.signatures?.signature === 'sphirewall.application.porn') {
                            chrome.tabs.get(details.tabId, tab => {

                                // if we have since moved away from the page that initiated the request, ignore the verdict
                                if (extractHostname(details.initiator) === (extractHostname(tab.url))) {
                                    chrome.tabs.update(
                                        details.tabId,
                                        { url: redirectUri },
                                        () => {
                                            console.log("redirected: " + details.tabId)
                                        }
                                    );
                                }
                            });
                        }
                    }
                    // else {
                    //     const safeSearchRedirect =  this.enforceGoogleSafeSearchIfRequired(details.url) || this.enforceBingSafeSearchIfRequired(details.url);
                    //     if(safeSearchRedirect){
                    //         chrome.tabs.update(
                    //             details.tabId,
                    //             { url: safeSearchRedirect },
                    //             () => {
                    //                 console.log("redirected: " + details.tabId)
                    //             }
                    //         );
                    //     }
                    // }
                });
            }
        }

    }

    enforceBingSafeSearchIfRequired = (url) => {
        if (url && config.isBingSafeSearchEnabled()) {
            const parsedUrl = new URL(url);
            const check = /\.bing\.com$/.test(parsedUrl.hostname) && /^(\/search|\/videos|\/images|\/news)/.test(parsedUrl.pathname);
            if (check) {
                parsedUrl.searchParams.delete('adlt')
                return parsedUrl.href + "&adlt=strict";
            }
        }
    }

    enforceGoogleSafeSearchIfRequired = (url) => {
        if (url && config.isGoogleSearchEnabled()) {
            const parsedUrl = new URL(url);
            const check = /\.google.*$/.test(parsedUrl.hostname) && /^\/search/.test(parsedUrl.pathname);
            if (check && parsedUrl.searchParams.get('safe') !== 'active') {
                parsedUrl.searchParams.delete('safe')
                return parsedUrl.href + "&safe=active";
            }
        }
    }

    redirect_mylinewize() {
        let redirect_url = "https://mylinewize." + config.active_region + ".linewize.net/login";
        let token = config.getCurrentUserInfo()["token"] ? config.getCurrentUserInfo()["token"] : "";
        redirect_url += "?cid=" + config.chromeId;
        redirect_url += "&ce=true";
        redirect_url += "&u=" + config.getCurrentUserInfo()["user"];
        redirect_url += "&ge=" + config.getCurrentUserInfo()["email"];
        redirect_url += "&d=" + config['device_id'];
        redirect_url += "&gt=" + token;
        return redirect_url
    }

    isFallback() {
        return this.fallback_until > (new Date).getTime() || this.noUserFallback;
    }

    shouldCheckFilter(details) {
        let domain = extractHostname(details.url);
        let isBadUrl = domain === extractHostname(config.getVerdictServerUrl())
            || domain.indexOf(".") < 0
            || domain === "localhost"
            || details.url.toLowerCase().startsWith("chrome");
        return details &&
            config.isFilteringEnabled() &&
            !isBadUrl &&
            config.userFound &&
            !(details.initiator && details.initiator.toLowerCase().startsWith("chrome")) &&
            !(this.isFallback());
    }

    get__verdict_from_cache(domain) {
        if (domain in this.cache && this.cache[domain]) {
            return this.cache[domain]
        }
        return undefined;
    }

    reset__verdict_cache() {
        this.cache = {}
    }

    trigger_fallback() {
        //now + 2 minutes
        this.fallback_until = (new Date).getTime() + 120000;
        this.requestTimeSamples = arrayQueue(10);
        logging__warning("Entering Fallback Mode - trying verdict gw again at " + new Date(this.fallback_until));
    }

    get__average_request_time() {
        let total = this.requestTimeSamples.reduce(function (a, b) {
            return a + b;
        }, 0);
        let average_time = total / this.requestTimeSamples.length;
        logging__debug("Average request time: " + average_time);
        if (average_time > 5000) {
            this.trigger_fallback();
        }
        return average_time
    }

    is_bypass(website) {
        let hostname = extractHostname(website);
        if (hostname.includes("linewize.net") && website.includes("bypass_active")) {
            return true;
        }
        return false;
    }

    /*
        Check if we can skip retrieving a verdict, generate a verdict with a ttl if so.
        Also check the verdict cache, return any cache hits.
    */
    getEarlyVerdict = (domain, website, excludeCache, ignoreTtl) => {
        if (this.is_bypass(website)) {
            this.reset__verdict_cache()
        }

        if (this.isSearchAutoComplete(website)) {
            logging__debug(`Request is a search auto complete, skipping verdict`, website);
            return {
                ttl: 60
            };
        }

        // ignore invalid domains
        if ((website.startsWith("chrome:") || website.startsWith("chrome-extension:")
            || domain.includes("linewize.net")
            || domain === extractHostname(config.getVerdictServerUrl())
            || domain.indexOf(".") < 0
        )
            && domain !== "localhost") {
            // logging__warning("bad domain:", website);
            // cache invalid domains for a long time
            return {
                ttl: 999999999
            };
        }

        if (!excludeCache) {
            const cacheHit = this.getVerdictCacheHit(domain, ignoreTtl);
            if (cacheHit) {
                return cacheHit;
            }
        }

        return null;
    }

    /*
        Check the in-memory verdict cache for a domain match
    */
    getVerdictCacheHit = (domain, ignoreTtl) => {
        let cacheHit = this.get__verdict_from_cache(domain);
        if (cacheHit && (ignoreTtl || (this.cache[domain].time_retrieved + this.cache[domain].ttl) > nowInSeconds())) {
            stats.incrementStats("Filtering", "cacheHit", 1);
            return cacheHit;
        }
        return undefined;
    }

    /*
        Promise-based verdict resolver for asynchronous verdict handling.
    */
    getVerdictPromise = (website, ignoreTtl, tabId, search_query = null) => {
        return new Promise((resolve, reject) => {
            const domain = extractHostname(website);
            const path = encodeURIComponent(extractURLPath(website));

            const excludeCache = this.isGoogleSearchPathExclusion(domain, path);
            const earlyVerdict = this.getEarlyVerdict(domain, website, excludeCache, ignoreTtl);

            if (earlyVerdict) {
                resolve(earlyVerdict);
                return;
            }

            this.apiGetVerdictPromise(domain, path, tabId, search_query)
                .then((new_verdict) => {
                    if (!new_verdict) {
                        new_verdict = {
                            ttl: 5
                        };
                        logging__warning("Verdict for website was undefined", website, new_verdict);
                    }
                    new_verdict.time_retrieved = nowInSeconds();
                    if (!excludeCache && new_verdict.ttl > 0) {
                        this.cache[domain] = new_verdict;
                    }
                    resolve(new_verdict);
                })
                .catch(() => {
                    reject()
                });
        })
    };

    /*
        Synchronous verdict resolver. Used in the blocking verdict handler in onBeforeRequest
    */
    get__verdict = (website, ignoreTtl, tabId, search_query = null, skipCache = false) => {
        const domain = extractHostname(website);
        const path = encodeURIComponent(extractURLPath(website));
        const excludeCache = this.isGoogleSearchPathExclusion(domain, path);

        if (!skipCache) {
            const earlyVerdict = this.getEarlyVerdict(domain, website, excludeCache, ignoreTtl);
            if (earlyVerdict) {
                return earlyVerdict;
            }
        }

        let new_verdict = this.api__get_verdict(domain, path, tabId, search_query);

        if (!new_verdict) {
            new_verdict = {
                ttl: 5
            };
            logging__warning("Verdict for website was undefined", website, new_verdict);
        }

        new_verdict.time_retrieved = nowInSeconds();

        if (!excludeCache && new_verdict.ttl > 0) {
            this.cache[domain] = new_verdict;
        }

        return new_verdict;
    };

    isGoogleSearchPathExclusion = (domain, path) => {

        return (domain && path
            && domain.includes("google")
            && path.startsWith("search", 0));
    }

    isGoogleMapsVerdictBypass = (webRequestDetails) => {
        // defensive in case of any strangeness, shouldn't happen but we don't want to skip verdicts because of this patch...
        try {
            const url = new URL(webRequestDetails.url);
            const refinedUrl = url.hostname + url.pathname;
            const isBypass = refinedUrl.includes('google.com/maps/vt');
            return isBypass;
        }
        catch (ex) {
            console.error('caught error, skipping google maps verdict bypass check.', ex)
        }

        return false;
    }

    isSearchAutoComplete(website) {
        const hostname = extractHostname(website);
        const path = extractURLPath(website).toLowerCase();

        if (hostname.includes("google") || hostname.includes("youtube")) {
            return path.match(/^complete\/search\?.*$/);
        }
        if (hostname.includes("bing")) {
            return path.match(/^as\/suggestions\?.*$/);
        }
        if (hostname.includes("duckduckgo")) {
            return path.match(/^ac\/?\?.*$/);
        }
        return false;
    }

    getYoutubeSearchQuery(details) {
        let search_query = null;
        try {
            if (this.isYoutubePostSearch(details.url, details.method)) {
                const cacheKey = `${details.requestId}_${details.url}`
                if (details.requestBody) {
                    const requestBodyString = decodeURIComponent(String.fromCharCode.apply(null,
                        new Uint8Array(details.requestBody.raw[0].bytes)));
                    search_query = JSON.parse(requestBodyString).query;
                    this.cacheForYoutubeQuery.set(cacheKey, search_query);
                }
                else {
                    search_query = this.cacheForYoutubeQuery.get(cacheKey);
                }
            }
        } catch (e) {
            logging__warning("Couldn't retrieve search query from requestBodyString. YouTube Search RequestBody changed?", e);
        }
        return search_query;
    }

    isYoutubePostSearch(url, method) {
        const hostname = extractHostname(url);
        return hostname.includes("youtube") && url.includes("search") && method === "POST";
    }

    /*
        Retrieves a verdict using asynchronous xhr, returns a Promise
    */
    apiGetVerdictPromise(website, path, tabId, search_query = null) {
        return new Promise((resolve, reject) => {
            if (this.isFallback()) {
                logging__debug("In Fallback mode, skipping verdict for " + website);
                resolve(undefined);
                return;
            }

            if (!config.device_id) {
                reject();
                return;
            }

            logging__debug("Checking verdict for website " + website);

            if (config.getVerdictServerUrl()) {
                let xhr = new XMLHttpRequest();
                let device_param = "&deviceid=" + config.device_id
                let start_time = (new Date).getTime();
                let chrome_version_param = "&cev=" + chrome.runtime.getManifest().version;
                let query_params = "?requested_website=" + website +
                    "&identity=" + config.getCurrentUserInfo().user +
                    "&chrome_id=" + config.chromeId + chrome_version_param + device_param +
                    "&requested_path=" + path

                if (!!search_query) {
                    query_params += "&search_query=" + encodeURIComponent(search_query);
                }

                xhr.open("GET", config.getVerdictServerUrl() + "/get/verdict" + query_params, true);
                let completed_time = start_time;

                xhr.onload = () => {
                    if (xhr.status !== 200) {
                        logging__warning("Failed, status was " + xhr.status.toString(), xhr.responseText);
                        completed_time = start_time + (10000); // 10 seconds
                        resolve(undefined);
                        return;
                    }
                    let response = JSON.parse(xhr.responseText);
                    logging__debug("Got a response for website " + website, response);
                    completed_time = (new Date).getTime();

                    let request_time = completed_time - start_time;
                    this.requestTimeSamples.push(Math.min(request_time, 10000));
                    this.get__average_request_time();

                    resolve(response);
                }

                xhr.onerror = () => {
                    logging__error("ERROR", e);
                    completed_time = start_time + (10000); // 10 seconds
                    logging__message("Delegating filtering check to safeguard since verdict request failed")
                    this.safeguardCheck(tabId)

                    reject(undefined);
                }

                xhr.send();
            }
        });
    }

    /*
        Gets verdict using a synchronous xhr
    */
    api__get_verdict(website, path, tabId, search_query = null) {
        if (this.isFallback()) {
            logging__debug("In Fallback mode, skipping verdict for " + website);
            return undefined;
        }

        if (!config.device_id) {
            return
        }

        logging__debug("Checking verdict for website " + website);

        if (config.getVerdictServerUrl()) {
            let xhr = new XMLHttpRequest();
            let device_param = "&deviceid=" + config.device_id
            let start_time = (new Date).getTime();
            let chrome_version_param = "&cev=" + chrome.runtime.getManifest().version;
            let query_params = "?requested_website=" + website +
                "&identity=" + config.getCurrentUserInfo().user +
                "&chrome_id=" + config.chromeId + chrome_version_param + device_param +
                "&requested_path=" + path
            if (!!search_query) {
                query_params += "&search_query=" + encodeURIComponent(search_query);
            }
            xhr.open("GET", config.getVerdictServerUrl() + "/get/verdict" + query_params, false);
            let completed_time = start_time;
            try {
                xhr.send();
                if (xhr.status !== 200) {
                    logging__warning("Failed, status was " + xhr.status.toString(), xhr.responseText);
                    completed_time = start_time + (10000); // 10 seconds
                    return undefined;
                }
                let response = JSON.parse(xhr.responseText);
                logging__debug("Got a response for website " + website, response);
                completed_time = (new Date).getTime();
                return response;
            } catch (e) {
                logging__error("ERROR", e);
                completed_time = start_time + (10000); // 10 seconds
                logging__message("Delegating filtering check to safeguard since verdict request failed")
                this.safeguardCheck(tabId)
                return undefined;
            } finally {
                // if the verdict didn't reach the server, don't include it in verdict response time sampling
                if (xhr.status !== 0) {
                    let request_time = completed_time - start_time;
                    this.requestTimeSamples.push(Math.min(request_time, 10000));
                    this.get__average_request_time();
                }
            }
        }
        return undefined;
    }


    api__get_should_close_tab_on_policy_change(website) {
        if (config.getVerdictServerUrl()) {

            if (!config.device_id) {
                return;
            }

            let xhr = new XMLHttpRequest();
            let start_time = (new Date).getTime();
            let device_param = "&deviceid=" + config.device_id
            let path = encodeURIComponent(extractURLPath(website));
            let chrome_version_param = "&cev=" + chrome.runtime.getManifest().version;

            xhr.open("GET", config.getVerdictServerUrl() + "/check/classroom/verdict?" +
                "identity=" + config.getCurrentUserInfo().user +
                "&chrome_id=" + config.chromeId + chrome_version_param + device_param +
                "&requested_website=" + website +
                "&requested_path=" + path,
                false
            );
            let completed_time = start_time;
            try {
                xhr.send();
                if (xhr.status !== 200) {
                    logging__warning("Failed, status was " + xhr.status.toString(), xhr.responseText);
                    completed_time = start_time + (10000); // 10 seconds
                    return undefined;
                }
                let response = JSON.parse(xhr.responseText);
                logging__debug("Got a response for website " + website, response);
                completed_time = (new Date).getTime();
                return response;
            } catch (e) {
                logging__error("ERROR", e);
                completed_time = start_time + (10000); // 10 seconds
                return undefined;
            } finally {
                let request_time = completed_time - start_time;
                this.requestTimeSamples.push(Math.min(request_time, 10000));
                this.get__average_request_time();
            }
        }
        return undefined;
    }

    safeguardCheck(tabId) {
        if (tabId > -1) {
            chrome.tabs.sendMessage(tabId, { message: 'safeguardCheckSite' })
        }
    }
}

class TemporaryFixedSizeCache {
    constructor(size = 5) {
        this.store = {};
        this.keys = [];
        this.size = size;
    }

    get = (key) => {
        return this.store[key];
    };

    set = (key, value) => {
        this.store[key] = value;
        if (!this.keys.includes(key)) {
            this.keys.push(key);
        }
        if (this.keys.length > this.size) {
            delete this.store[this.keys.shift()];
        }
    };
}
