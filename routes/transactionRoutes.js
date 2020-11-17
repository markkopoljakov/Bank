const router = require('express').Router(); 
const accountModel = require('../models/Account'); 
const { verifyToken, refreshBanksFromCentralBank } = require('../middlewares/middlewares'); 
const transactionModel = require('../models/Transactions'); 
const sessionModel = require('../models/Sessions'); 
const userModel = require('../models/User'); 
const bankModel = require('../models/CentralBank'); 
const fs = require('fs'); 
const axios = require('axios'); const jose = require('node-jose'); 
const fetch = require('node-fetch');

require('dotenv').config();

router.get('/', verifyToken, async(req, res) => {
    try {
// Get a specific users session token
        const sessionId = req.headers.authorization.split(' ')[1]

        // Find a session with the provided Id
        const session = await sessionModel.findOne({ _id: sessionId });

        // Find the account associated with the user
        const accountId = await accountModel.findOne({user: session.userId});
	console.log(accountId.accountNumber);
        // Find all transactions
        const sentTransaction = await transactionModel.find({ userId: accountId.user })

        const receivedTransaction = await transactionModel.find({accountTo: accountId.accountNumber});

        if (!sentTransaction || !receivedTransaction) {
            res.status(404).json({ error: "You have no logged transactions" });
        } 
            console.log("Displaying transactions")
            res.status(200).json({
                transactions: sentTransaction,
                received: receivedTransaction
            });
    } catch (e) {
        return res.status(400).json({error: "error"})
    }
})
router.post('/', verifyToken, async(req, res, next) => {
    let banks = [],
        statusDetail
    const loggedUserAccount = await accountModel.findOne({ accountNumber: req.body.accountFrom});
console.log(loggedUserAccount);
   if (!loggedUserAccount) {
        return res.status(404).json({ error: 'Account not found' })
    }
// Check for sufficient funds
    if (req.body.amount > loggedUserAccount.balance) {
        return res.status(402).json({ error: 'Insufficient funds' });
    }

    // Check for invalid amounts
    if (!req.body.amount || req.body.amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }
    // Check if that accountFrom belongs to the user
    if (loggedUserAccount.user.toString() !== req.userId.toString()) {
        return res.status(403).json({ error: 'Forbidden. This account does not belong to you' })
    }
    if (!req.body.accountTo) {
        return res.status(400).json({ error: 'Invalid accountTo' })
    }
    if (req.body.accountTo==loggedUserAccount.accountNumber) return res.status(409).json({error: "You cannot transfer to yourself"})
    const bankToPrefix = req.body.accountTo.slice(0, 3)
    let bankTo = await bankModel.findOne({ bankPrefix: bankToPrefix });
    console.log(bankTo, bankToPrefix);
    // Check destination bank
    if (!bankTo) {

        // Refresh banks from central bank
        const result = await refreshBanksFromCentralBank();

        // Check if there was an error
        if (typeof result.error !== 'undefined') {

            // Log the error to transaction
            console.log('There was an error communicating with central bank:')
            console.log(result.error)
            statusDetail = result.error
        } else {

            // Try getting the details of the destination bank again
            bankTo = await bankModel.findOne({ bankPrefix: bankToPrefix })

            // Check for destination bank once more
            if (!bankTo) {
                return res.status(400).json({ error: 'Invalid accountTo blabla' })
            }
        }
    } else {
        console.log('Destination bank was found in cache');
    }

    // Make new transaction
    console.log('Creating transaction...')
    const transaction = transactionModel.create({
        userId: req.userId,
        amount: req.body.amount,
        currency: loggedUserAccount.currency,
        accountFrom: req.body.accountFrom,
        accountTo: req.body.accountTo,
        explanation: req.body.explanation,
        statusDetail,
        senderName: (await userModel.findOne({ _id: req.userId })).name
    })

    return res.status(201).json({message: 'Transaction created successfully'})
})

module.exports = router;
