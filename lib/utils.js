
class Notifications {

    /**
     *
     * @param {string} title
     * @param {string} body
     * @param {string} icon
     * @param {number} duration
     */
    static notify(title, body, icon, duration = 0) {

        //not.show();
        if (duration > 0) {
            let not = new Notification(title, {body: body, icon: icon});

            setTimeout(function () {
                not.close();
            }, duration * 1000);
        }
    }
}

class Prices {
    /**
     *
     * @param amount
     * @param price
     * @returns {Coin}
     */
    static convert(amount, price) {
        let amountConverted = (amount.amount * price.amount) / Math.pow(10, amount.currency.scale + price.currency.scale);
        return Coin.parseCash(amountConverted, price.currency);
    }
}

if (module) {
    module.exports = {
        Notifications, Prices
    }
}