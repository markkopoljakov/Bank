const mongoose = require("mongoose");
require('dotenv').config();

const accountSchema = mongoose.Schema({
    accountNumber: {
        type: String,
       default: function () {
            return process.env.BANK_PREFIX + require('md5')(new Date().toISOString())
        }
    },
    balance: {
        type: Number,
        default: 50,
    },
    currency: {
        type: String,
        minlength: 3,
        maxlength: 3,
        default: "EUR"
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
});

module.exports = mongoose.model("Account", accountSchema);