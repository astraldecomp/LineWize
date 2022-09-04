/* */
class ContentFilter {

    constructor() {
        this.currentUrl = window.location.href;
        this.overrideResponseMessageId = null;

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.message === 'safeguardCheckSite') {
                console.log('safeguardCheckSite')
                if (document.readyState === 'interactive' || document.readyState === 'complete') {
                    this.overrideResponseMessageId = "delegatedBlockSite"
                    this.init()
                }
                else {
                    document.addEventListener('DOMContentLoaded', () => {
                        this.overrideResponseMessageId = "delegatedBlockSite"
                        this.init()
                    }, {once: true})
                }
            }
        })
    }

    triggerBlock() {
        console.log("Adult content detected");
        const message = this.overrideResponseMessageId || "blockSite";
        chrome.extension.sendMessage({
            message: message,
            url: this.currentUrl,
            reason: "porn"
        }, function (response) {
            if (response.message === "redirect") {
                window.location.href = response.redirectUrl;
            }
        });
        
        this.overrideResponseMessageId = null;
    }

    checkTitle() {
        let title = document.title;
        let regex_search = new RegExp("porn", "i")
        if (title.length > 0) {
            if (regex_search.test(title)) {
                this.triggerBlock();
            }
        }
    }

    checkRequest() {
      console.log("Checking site now that its loaded.");
      chrome.extension.sendMessage({
          message: "checkRequest",
          url: this.currentUrl
      }, function (response) {
          if (response.message === "redirect") {
              window.location.href = response.redirectUrl;
          }
      });
    }

    checkContent() {
        let query = "//body[";
        query += "contains(., 'age-restricted')";
        query += " or ";
        query += "contains(., 'Warning: This Site Contains Sexually Explicit Content')";
        query += " or ";
        query += "contains(., ' contains adult material')";
        query += " or ";
        query += "contains(., 'website contains adult material')";
        query += " or ";
        query += "contains(., 'ADULTS ONLY DISCLAIMER')";
        query += " or ";
        query += "contains(., 'Warning: You must be 18 years or older')";
        query += " or ";
        query += "contains(., 'adult-only')";
        query += " or ";
        query += "contains(., 'porn')";
        query += " or ";
        query += "contains(., 'fuck')";
        query += "]";

        let headings = document.evaluate(query, document, null, XPathResult.ANY_TYPE, null),
            thisHeading = headings.iterateNext();
        //console.log("thisHeading=" + thisHeading);
        if (thisHeading) {
            let textContent = thisHeading.textContent;
            //console.log("text content=" + textContent);
            if (textContent) {
                textContent = textContent.toLowerCase();
                if (textContent.indexOf("porn") !== -1 ||
                    textContent.indexOf("sex") !== -1 ||
                    textContent.indexOf("adult") !== -1
                ) {
                    this.triggerBlock();
                }
            }
        }
    }

    init() {
        console.log("Checking page...");
        this.checkTitle();
        this.checkContent();
    }
}

const content = new ContentFilter();

content.checkRequest();
document.addEventListener("DOMContentLoaded", function () {
    content.init();
}, true);
