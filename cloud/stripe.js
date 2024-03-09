module.exports=function stripe({
    apiKey, 
    endpointSecret, 
    onPurchase=defaultOnPurchase, 
    path="/stripe/pay", 
    transactionFee=0.3, 
    transactionRate=2.9,
    extractPurchase=defaultExtractPurchase,
}){
    const iap=require("react-native-use-qili/cloud/iap")(...arguments)
    const stripe = require('stripe')(apiKey);
    iap.name="stripe payment"

    iap.static=async function(service){
        service.on(path, async function(req, response){
            try {
                if(!req.user){
                    throw new Error('not authenticated user')
                }
                const payload=req.body
                const event =  payload //stripe.webhooks.constructEvent(payload, req.headers['stripe-signature'], endpointSecret);                
                // Handle the checkout.session.completed event
                if (event.type === 'checkout.session.completed') {
                    const [purchase,user]=await extractPurchase({event, req,transactionFee,transactionRate})
                    try{
                        await req.app.resolver.Mutation.buy(
                            {}, 
                            purchase, 
                            {app:req.app, user}
                        );
                        req.app.emit('purchase', purchase)
                        await onPurchase?.({app:req.app, user, event, purchase})
                    }catch(e){
                        if(e.message.indexOf('duplicate key error')==-1){
                            throw e
                        }else{
                            console.warn('stripe payment already addressed!')
                        }
                    }
                }
                
                response.status(200).end()
            } catch (err) {
                response.status(400).end(err.message)
            }
        })
    }

    return iap
}

function removeNullKeys(obj) {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (obj[key] === null) {
                delete obj[key];
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                removeNullKeys(obj[key]);
                if (Object.keys(obj[key]).length === 0) {
                    delete obj[key];
                }
            }
        }
    }
    return obj
}

async function defaultExtractPurchase({event, req, transactionFee, transactionRate}){
    event=removeNullKeys(event)
    const {type, client_reference_id:token, data:{object:{
        id,//xxxx
        object,//"checkout.session"
        payment_link,//plink_1OBpbSHKHUCpvkuPEcgLUGx9
        payment_status, //paid
        status,// "complete"
        created, 

        customer_details:{email, phone},
        currency,//usd, cad
        amount_total,//1$=100, 10$=1000
        currency_conversion:{source_currency="usd",fx_rate="1.0"}={},
        paid=Math.ceil((amount_total)/parseFloat(fx_rate)*1000),
        validPaid=Math.ceil((amount_total-100*transactionFee)*(100-transactionRate)/100/parseFloat(fx_rate)*1000)
    }}}=event

    const purchase={
        _id:`stripe_${id}`,
        provider:'stripe',
        sku: payment_link, 
        paid,validPaid,
        expires_date_ms: (created+10*365*24*60*60)*1000,//10 years
        purchase_date_ms: created*1000,
        original_purchase_date_ms: created*1000,
        _event: removeNullKeys(event),
    }
    
    const user=token ? await req.app.decode(token) : req.app.getUserByContact(phone||email)
    return [purchase, user]
}

async function defaultOnPurchase({app,user,purchase, event}){
    await app.patchEntity("User", {_id:user._id}, {$inc:{balance:purchase.validPaid}})
    app.emit('purchase.verified', purchase.validPaid)
}