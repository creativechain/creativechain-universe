/**
 * Created by ander on 28/07/17.
 */

class WordReference {
    constructor(word, txHash, date, order) {
        this.word = word;
        this.txHash = txHash;
        this.date = date;
        this.order = order;
    }
}

class SmartAction {
    constructor(txHash, ntx, addr, date, type, data) {
        this.txHash = txHash;
        this.ntx = ntx;
        this.addr = addr;
        this.date = date;
        this.type = type;
        this.data = data;
    }
}

class Content {
    constructor() {
        this.wordReferences = [];
        this.smartActions = [];
    }

    /**
     *
     * @param {WordReference} wordReference
     */
    addWordReference(wordReference) {
        this.wordReferences.push(wordReference)
    }

    /**
     *
     * @param {SmartAction} smartAction
     */
    addContract(smartAction) {
        this.smartActions.push(smartAction)
    }

    save() {
        File.write(Constants.CONTENT_PATH, this);
    }

    /**
     * 
     * @returns {Content}
     */
    static load() {
        let content = new Content();
        try {
            let contentFile = File.read(Constants.CONTENT_PATH);
            let obj = JSON.parse(contentFile);
            content.smartActions = obj.smartActions;
            content.wordReferences = obj.wordReferences;
        } catch (err) {

        }

        return content;
    }
}

if (module) {
    module.exports= {WordReference, SmartAction, Content}
}