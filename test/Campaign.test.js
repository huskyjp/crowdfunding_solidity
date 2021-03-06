const assert = require("assert");
const ganache = require("ganache-cli")
const Web3 = require("web3");
const web3 = new Web3(ganache.provider());

const compiledFactory = require("../ethereum/build/CampaignFactory.json");
const compiledCampaign = require("../ethereum/build/Campaign.json");

let accounts;
let factory;
let campaign;
let campaignAddress;


beforeEach(async () => {
  // get list of accounts
  accounts = await web3.eth.getAccounts();

  // get instance of factory contract by using compiledFactory
  // 1. get contract inside of web3
  // 2. deploy
  factory = await new web3.eth.Contract(compiledFactory.abi).deploy({
    data: compiledFactory.evm.bytecode.object
  }).send({
    from: accounts[0], gas: "1000000"
  });

  // access to createCampaign method which is one of the factory menthods
  // can't receive campaign address by only this call
  await factory.methods.createCampaign('100').send({
    from: accounts[0], // manager of this campaign
    gas: "1000000"
  });

  // get campaign address data by calling getDeployedCampaigns which is view method
  // it returns array of addresses but we just get the very first address, index 0
  [campaignAddress] = await factory.methods.getDeployedCampaigns().call();

  campaign = await new web3.eth.Contract(compiledCampaign.abi, campaignAddress);
});


describe('Campaigns', () => {
  it('deploys a factory and a campaign', () => {
    assert.ok(factory.options.address);
    assert.ok(campaign.options.address);
  });


  // creator of campaign should be marked as the manager of the campaign that is created
  it('marks caller as the campaign manager', async () => {
    const manager = await campaign.methods.manager().call(); // just access to public manager variable
    assert.strictEqual(accounts[0], manager);
  });

  // check if it is able to contribute to the campaign - and if the account is marked as approver
  it('allows people to contribute money and marks them as approvers', async () => {
    await campaign.methods.contribute().send({
      value: '200',
      from: accounts[1]
    });
    // get map of approvers and check if it marked as true
    const isContributor = await campaign.methods.approvers(accounts[1]).call();
    assert(isContributor);

  });

  // check if minimum contribution user made
  it('requires a minimum constribution', async () => {
    try{
      await campaign.methods.contribute().send({
        value: '5',
        from: accounts[1]
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });

  // check if manager has a power to request for payment
  it('allows manager to make a payment request', async () => {
    await campaign.methods
    .createRequest('Buy Bitcoin', '100', accounts[1])
    .send({
      from: accounts[0],
      gas: 1000000
    });
    const request = await campaign.methods.requests(0).call();
    assert.strictEqual('Buy Bitcoin', request.description);

  });

  // check if other parties received
  it('check if request is finalizable', async () => {
    await campaign.methods.contribute().send({
      from: accounts[0],
      value: 2000
    });

    await campaign.methods.createRequest('Please let me use ETH',100, accounts[1]).send({
      from: accounts[0], 
      gas: 1000000
    });

  await campaign.methods.approveRequest(0).send({
    from: accounts[0],
    gas: 1000000
  });

  await campaign.methods.finalizeRequest(0).send({
    from: accounts[0],
    gas: 1000000
  });

  let request = await campaign.methods.requests(0).call();
  assert.ok(request.complete);
});

});

