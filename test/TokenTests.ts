// version update: 30-March-2023
import { expect } from "chai";
import  hre, { ethers } from 'hardhat';
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";

const LOSSLESS_ROLE = keccak256(toUtf8Bytes("LOSSLESS"));
const WALLET_ROLE = keccak256(toUtf8Bytes("WALLET"));
const BOT_ROLE = keccak256(toUtf8Bytes("BOT"));
const MAX_ROLE = keccak256(toUtf8Bytes("MAX"));
const FEE_ROLE = keccak256(toUtf8Bytes("FEE"));
const losslessV2Controller = '0xe91D7cEBcE484070fc70777cB04F7e2EfAe31DB4'
const losslessAdmin = '0x4CcEE09FDd72c4CbAB6f4D27d2060375B27cD314'
const keyHash = '0x69111cecadeb2df9a8e26fa95ee9b81606b9d4c9c0b6956fca7204f457ec1d19'
const key = '0x52617265416e746971756974696573546f6b656e41646d696e53656372657432303232'
const botWallet = '0x51EeAb5b780A6be4537eF76d829CC88E98Bc71e5'
const maxAmount = ethers.utils.parseUnits("2500000000", "wei")

describe("Token contract", function () {
    async function deployTokenFixture() {
      const [owner, user1, user2, user3, user4, marketing, antiques, gas, trusted, recoveryAdmin] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("TheRareAntiquitiesTokenLtd", owner);
        const token = await Token.deploy(marketing.address, antiques.address, gas.address, trusted.address, [owner.address, user1.address, user2.address, user3.address, user4.address]);
        await token.deployed();

        await token.connect(owner).transfer(user1.address, ethers.utils.parseUnits("5000", "gwei"))

        const routerInstance = await ethers.getContractAt("IRARESwapRouter", await token.rareSwapRouter())
        const pairFactory = await ethers.getContractAt("IRARESwapFactory", await routerInstance.factory())
        const pairInstance = await ethers.getContractAt("IRARESwapPair", await token.rareSwapPair())

        return { token, owner, user1, user2, user3, user4, marketing, antiques, gas, trusted, recoveryAdmin, losslessV2Controller, losslessAdmin, keyHash, key, maxAmount, botWallet, routerInstance, pairInstance, pairFactory };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { token, owner } = await loadFixture(deployTokenFixture);
            expect(await token.owner()).to.equal(owner.address);
        });

        it("Should set the correct totalSupply", async function () {
            const { token } = await loadFixture(deployTokenFixture);
            expect(await token.totalSupply()).to.equal(ethers.utils.parseUnits("500000000000", "gwei"));
        });

        it("Should have init fees as zero", async function () {
            const { token } = await loadFixture(deployTokenFixture);
            expect(await token.totalFees()).to.equal(0);
        })

      });
    
    describe("Basic ERC20 functions", function() {

      it("Should check approve function", async function(){
        const { token, owner, user1 } = await loadFixture(deployTokenFixture);

        expect(await token.allowance(owner.address, user1.address)).to.equal(0);
        // Owner approves user1 to spend 1000 tokens
        await token.connect(owner).approve(user1.address, ethers.utils.parseUnits("1000", "gwei"));
        
        expect(await token.allowance(owner.address, user1.address)).to.equal(ethers.utils.parseUnits("1000", "gwei"));
      })

      it("Should increase Allowance", async function(){
        const { token, owner, user1 } = await loadFixture(deployTokenFixture);

        expect(await token.allowance(owner.address, user1.address)).to.equal(0);
        // Owner approves user1 to spend 1000 tokens
        await token.connect(owner).approve(user1.address, ethers.utils.parseUnits("1000", "gwei"));
        
        expect(await token.allowance(owner.address, user1.address)).to.equal(ethers.utils.parseUnits("1000", "gwei"));

        await token.connect(owner).increaseAllowance(user1.address, ethers.utils.parseUnits("1000", "gwei"));

        expect(await token.allowance(owner.address, user1.address)).to.equal(ethers.utils.parseUnits("2000", "gwei"));
      })

      it("Should decrease allowance", async function(){
        const { token, owner, user1 } = await loadFixture(deployTokenFixture);

        expect(await token.allowance(owner.address, user1.address)).to.equal(0);
        // Owner approves user1 to spend 1000 tokens
        await token.connect(owner).approve(user1.address, ethers.utils.parseUnits("1000", "gwei"));
        
        expect(await token.allowance(owner.address, user1.address)).to.equal(ethers.utils.parseUnits("1000", "gwei"));

        await token.connect(owner).decreaseAllowance(user1.address, ethers.utils.parseUnits("500", "gwei"));

        expect(await token.allowance(owner.address, user1.address)).to.equal(ethers.utils.parseUnits("500", "gwei"));
      })

    })

    describe("Set LossLess", function () {
    
      describe("Set LossLess Controller", () => {
        
        describe("when sender is not the role", () => {
          it("should revert", async () => {
            const { token, owner, losslessV2Controller } = await loadFixture(deployTokenFixture);
            await expect(token.connect(owner).setLosslessController(losslessV2Controller)).to.be.revertedWith(`AccessControl: account ${owner.address.toLowerCase()} is missing role ${LOSSLESS_ROLE}`)
          })
        })
    
        describe("when sender is ROLE", () => {
          it('should revert when setting to zero address', async () => {
            const { token, user1 } = await loadFixture(deployTokenFixture);
            await expect(
                token.connect(user1).setLosslessController('0x0000000000000000000000000000000000000000'),
              ).to.be.revertedWith('BridgeMintableToken: Controller cannot be zero address.');
            });
          it("should succeed", async () => {
            const { token, user1, losslessV2Controller } = await loadFixture(deployTokenFixture);
            await token.connect(user1).setLosslessController(losslessV2Controller)
              expect(await token.lossless()).to.be.equal(losslessV2Controller)
          })
        })
      })
    
      describe("Set LossLess Admin", () => {

        
        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, losslessAdmin, owner,  } = await loadFixture(deployTokenFixture);
            await expect(token.connect(owner).setLosslessAdmin(losslessAdmin)).to.be.revertedWith(`AccessControl: account ${owner.address.toLowerCase()} is missing role ${LOSSLESS_ROLE}`)
          })
        })
    
        describe("when sender is ROLE", () => {
          it("should succeed", async () => {
            const { token, user1, losslessAdmin } = await loadFixture(deployTokenFixture);
            await token.connect(user1).setLosslessAdmin(losslessAdmin)
              expect(await token.admin()).to.be.equal(losslessAdmin)
          })
        })
      })
    
      describe("Set Recovery Admin", () => {

        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, owner, recoveryAdmin, keyHash } = await loadFixture(deployTokenFixture);
    
            await expect(token.connect(owner).transferRecoveryAdminOwnership(recoveryAdmin.address, keyHash)).to.be.revertedWith(`AccessControl: account ${owner.address.toLowerCase()} is missing role ${LOSSLESS_ROLE}`)
          })
        })
      
        describe("when sender is ROLE", () => {
          it("should succeed", async () => {
            const { token, user1, recoveryAdmin, keyHash, key} = await loadFixture(deployTokenFixture);
            await token.connect(user1).transferRecoveryAdminOwnership(recoveryAdmin.address, keyHash);
            await token.connect(recoveryAdmin).acceptRecoveryAdminOwnership(key);
          })
        })
      })
      
    })

    describe("Token Owner Functions", function () {

      describe("Role Setter", () => {
        it("should set the right role", async () => {
          const { token, owner, user1 } = await loadFixture(deployTokenFixture);
          expect(await token.hasRole(LOSSLESS_ROLE, user1.address)).to.be.equal(true)
        })

        it("should renounce the right role", async () => {
          const { token, user1 } = await loadFixture(deployTokenFixture);
          await token.connect(user1).renounceRole(LOSSLESS_ROLE,user1.address)
          expect(await token.hasRole(LOSSLESS_ROLE, user1.address)).to.be.equal(false)
        })

        it("should not allow role granting" , async () => {
          const { token, owner } = await loadFixture(deployTokenFixture);
          await expect(token.connect(owner).grantRole(LOSSLESS_ROLE, owner.address)).to.be.revertedWith(`AccessControl: account ${owner.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`)
        })
      })
    
      describe("Enable Trading", () => {
        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, user1 } = await loadFixture(deployTokenFixture);
            await expect(token.connect(user1).enableTrading()).to.be.revertedWith("Ownable: caller is not the owner")
          })
        })
    
        describe("when sender is ROLE", () => {
          it("should succeed", async () => {
            const { token, owner } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            expect(await token.canTrade()).to.be.equal(true)
          })
        })
      })
    
      describe("Set Max Wallet Amount", () => {
        describe("when sender is not MAX", () => {
          it("should revert", async () => {
            const { token, user1, maxAmount } = await loadFixture(deployTokenFixture);
            await expect(token.connect(user1).setMaxWalletAmount(maxAmount)).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${MAX_ROLE}`)
          })
        })
    
        describe("when sender is ROLE", () => {
          it("wallet amount should exceed 0.5% of the supply", async () => {
            const { token, owner, maxAmount } = await loadFixture(deployTokenFixture);
            expect( await token.hasRole(MAX_ROLE, owner.address)).to.be.equal(true)
            expect(token.connect(owner).setMaxWalletAmount(maxAmount)).to.be.revertedWith("ERR: max wallet amount should exceed 0.5% of the supply")
          })
          it("should succeed", async () => {
            const { token, owner, maxAmount } = await loadFixture(deployTokenFixture);
            await token.connect(owner).setMaxWalletAmount((maxAmount.mul(2)))
            expect(await token._maxWallet()).to.be.equal(maxAmount.mul(2).mul(10**9))
          })
        })
      })
    
      describe("Set Max Tx Amount", () => {
        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, user1, maxAmount } = await loadFixture(deployTokenFixture);
            await expect(token.connect(user1).setMaxTxAmount(maxAmount)).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${MAX_ROLE}`)
          })
        })
    
        describe("when sender is ROLE", () => {
          it("wallet amount should exceed 0.5% of the supply", async () => {
            const { token, owner, maxAmount } = await loadFixture(deployTokenFixture);
            expect(token.connect(owner).setMaxTxAmount(maxAmount)).to.be.revertedWith("ERR: max wallet amount should exceed 0.5% of the supply")
          })
          it("should succeed", async () => {
            const { token, owner, maxAmount } = await loadFixture(deployTokenFixture);
            await token.connect(owner).setMaxTxAmount(maxAmount.mul(2))
            expect(await token._maxTxAmount()).to.be.equal(maxAmount.mul(2).mul(10**9))
          })
        })
      })
    
      describe("Add bot wallet", () => {
        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, user1, botWallet } = await loadFixture(deployTokenFixture);
            await expect(token.connect(user1).addBotWallet(botWallet)).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${BOT_ROLE}`)
          })
        })
    
        describe("when sender is ROLE", () => {
          it("should succeed", async () => {
            const { token, user4, botWallet } = await loadFixture(deployTokenFixture);
            await token.connect(user4).addBotWallet(botWallet)
            expect(await token.getBotWalletStatus(botWallet)).to.be.equal(true)
          })
        })
      })
    
      describe("Remove bot wallet", () => {
        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, user1, botWallet } = await loadFixture(deployTokenFixture);
            await expect(token.connect(user1).removeBotWallet(botWallet)).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${BOT_ROLE}`)
          })
        })
    
        describe("when sender is ROLE", () => {
          it("should succeed", async () => {
            const { token, user4, botWallet } = await loadFixture(deployTokenFixture);
            await token.connect(user4).removeBotWallet(botWallet)
            expect(await token.getBotWalletStatus(botWallet)).to.be.equal(false)
          })
        })
      })
    
      describe("Exclude From Fee", () => {
        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, user1, user2 } = await loadFixture(deployTokenFixture);
            await expect(token.connect(user1).excludeFromFee(user2.address)).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${FEE_ROLE}`)
          })
        })
    
        describe("when sender is ROLE", () => {
          it("should succeed", async () => {
            const { token, user2, user1 } = await loadFixture(deployTokenFixture);
            await token.connect(user2).excludeFromFee(user1.address)
            expect(await token.isExcludedFromFee(user1.address)).to.be.equal(true)
          })
        })
      })
    
      describe("Exclude From Reward", () => {
        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, user1, user2, } = await loadFixture(deployTokenFixture);
            await expect(token.connect(user1).excludeFromReward(user2.address)).to.be.revertedWith("Ownable: caller is not the owner")
          })
        })
    
        describe("when sender is ROLE", () => {
          it("should succeed", async () => {
            const { token, owner, user2 } = await loadFixture(deployTokenFixture);
            await token.connect(owner).excludeFromReward(user2.address)
            expect(await token.isExcludedFromReward(user2.address)).to.be.equal(true)
          })
        })
      })
    
      describe("Include In Fee", () => {
        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, user1, marketing } = await loadFixture(deployTokenFixture);
            await expect(token.connect(user1).includeInFee(marketing.address)).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${FEE_ROLE}`)
          })
        })
    
        describe("when sender is ROLE", () => {
          it("should succeed", async () => {
            const { token, user2, marketing } = await loadFixture(deployTokenFixture);
            await token.connect(user2).includeInFee(marketing.address)
            expect(await token.isExcludedFromFee(marketing.address)).to.be.equal(false)
          })
        })
      })
    
      describe("Set Antiquities Wallet", () => {
        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, user1, antiques } = await loadFixture(deployTokenFixture);
            await expect(token.connect(user1).setAntiquitiesWallet(antiques.address)).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${WALLET_ROLE}`)
          })
        })
    
        describe("when sender is ROLE", () => {
          it("should succeed", async () => {
            const { token, user3, antiques } = await loadFixture(deployTokenFixture);
            await token.connect(user3).setAntiquitiesWallet(antiques.address)
            expect(await token.antiquitiesWallet()).to.be.equal(antiques.address)
          })
        })
      })
    
      describe("Set Gas Wallet", () => {
        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, user1, gas } = await loadFixture(deployTokenFixture);
            await expect(token.connect(user1).setGasWallet(gas.address)).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${WALLET_ROLE}`)
          })
        })
    
        describe("when sender is ROLE", () => {
          it("should succeed", async () => {
            const { token, user3, gas } = await loadFixture(deployTokenFixture);
            await token.connect(user3).setGasWallet(gas.address)
            expect(await token.gasWallet()).to.be.equal(gas.address)
          })
        })
      })
    
      describe("Set Marketing Wallet", () => {
        describe("when sender is not owner", () => {
          it("should revert", async () => {
            const { token, user1, marketing } = await loadFixture(deployTokenFixture);
            await expect(token.connect(user1).setMarketingWallet(marketing.address)).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${WALLET_ROLE}`)
          })
        })
    
        describe("when sender is ROLE", () => {
          it("should succeed", async () => {
            const { token, user3, marketing } = await loadFixture(deployTokenFixture);
            await token.connect(user3).setMarketingWallet(marketing.address)
            expect(await token.marketingWallet()).to.be.equal(marketing.address)
          })
        })
      })

      describe("Set Fees", () => {
        it("should fail if not Fee role", async () => {
          const { token, user1 } = await loadFixture(deployTokenFixture);
          await expect(token.connect(user1).setFees(1, 1, 1, 1)).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${FEE_ROLE}`)
        })
        it("should succeed if fee is <15%", async()=>{
          const { token, user2 } = await loadFixture(deployTokenFixture);
          await token.connect(user2).setFees(100, 100, 100, 100)
          expect(await token._totalTax()).to.be.equal(400)
        })
      })
    })

    describe("Token Transactions", () => {
      describe("Transfer", () => {
        let transferAmount = ethers.utils.parseUnits("1000", "gwei")
        let totalTransferred = transferAmount.mul(99).div(100)

        it("should fail if trading is not enabled", async () => {
          const { token, user1, user2 } = await loadFixture(deployTokenFixture);
          await expect(token.connect(user1).transfer(user2.address, transferAmount)).to.be.revertedWith("Trade disabled");
        })

        it("should fail if sender is a bot", async() => {
          const { token, owner, user4, user1, user3, botWallet } = await loadFixture(deployTokenFixture);
          await token.connect(owner).enableTrading()
          await token.connect(user4).addBotWallet(user3.address)
          await expect(token.connect(user1).transfer(user3.address, transferAmount)).to.be.revertedWith("bots arent allowed to trade")
        })

        describe("when sender is excluded from fee", () => {

          it("should succeed", async () => {
            const { token, owner, user1, user2, user3 } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(user2).excludeFromFee(user1.address)
            await token.connect(user1).transfer(user3.address, transferAmount)
            expect(await token.balanceOf(user3.address)).to.be.equal(transferAmount)
          })
        })
    
        describe("when sender is not excluded from fee", () => {
          it("should succeed, sender has a bit more due to reflections", async () => {
            const { token, owner, user1, user2 } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(user1).transfer(user2.address, transferAmount)
            expect(await token.balanceOf(user1.address)).to.be.greaterThan(transferAmount.mul(4))
            expect(await token.balanceOf(user2.address)).to.be.greaterThan(totalTransferred)
          })
        })
        describe("when sender is excluded from reward", () => {
          it("should succeed to send funds to non excluded and non excluded should have a bit more due to reflections", async () => {
            const { token, owner, user1, user2 } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(owner).excludeFromReward(user1.address);
            await token.connect(user1).transfer(user2.address, transferAmount);
            
            expect(await token.balanceOf(user2.address)).to.be.equal(totalTransferred);
            expect(await token.balanceOf(user1.address)).to.be.equal(transferAmount.mul(4));
          })
          it("should succeed to send funds to excluded", async () => {
            const { token, owner, user1, user2 } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(owner).excludeFromReward(user1.address);
            await token.connect(owner).excludeFromReward(user2.address);
            await token.connect(user1).transfer(user2.address, transferAmount);
            expect(await token.balanceOf(user2.address)).to.be.equal(totalTransferred);
            expect(await token.balanceOf(user1.address)).to.be.equal(transferAmount.mul(4));
          })
          it("should succeed to send 0 value transfers", async () => {
            const { token, owner, user1, user2 } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(owner).excludeFromReward(user1.address);
            await token.connect(owner).excludeFromReward(user2.address);
            const u1Balance = await token.balanceOf(user1.address);
            await token.connect(user1).transfer(user2.address, 0);
            expect(await token.balanceOf(user2.address)).to.be.equal(0);
            expect(await token.balanceOf(user1.address)).to.be.equal(u1Balance);
          })
        })

        describe("when sender is not excluded from reward", () => {
          it("should succeed to send funds to non excluded and both should have a bit more due to reflections", async () => {
            const { token,owner, user1, user2 } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(user1).transfer(user2.address, transferAmount);
            expect(await token.balanceOf(user2.address)).to.be.greaterThan(totalTransferred);
            expect(await token.balanceOf(user1.address)).to.be.greaterThan(transferAmount.mul(4));
            expect(await token.totalFees()).to.be.greaterThan(0);
          })
          it("should deliver/burn some tokens", async()=>{
            const { token,owner, user1, user2 } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(user1).transfer(user2.address, transferAmount);
            const fees = await token.totalFees();
            const burnAmount = fees.div(10);
            console.log({fees, burnAmount})
            await token.connect(user1).deliver(burnAmount);
            expect(await token.totalFees()).to.be.equal(fees.add(burnAmount));
          })
          it("should succeed to send funds to excluded and non excluded should have a bit more due to reflections", async () => {
            const { token, owner, user1, user2 } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(owner).excludeFromReward(user2.address);
            await token.connect(user1).transfer(user2.address, transferAmount);
            expect(await token.balanceOf(user2.address)).to.be.equal(totalTransferred);
            expect(await token.balanceOf(user1.address)).to.be.greaterThan(transferAmount.mul(4));
          })
          it("should succeed to send 0 value transfers", async () => {
            const { token, owner, user1, user2 } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(owner).excludeFromReward(user2.address);
            const u1Balance = await token.balanceOf(user1.address);
            await token.connect(user1).transfer(user2.address, 0);
            expect(await token.balanceOf(user2.address)).to.be.equal(0);
            expect(await token.balanceOf(user1.address)).to.be.equal(u1Balance);
          })
        })

      })
    })

    describe("Token with Router interactions", () => {

      it("should have the pair created", async () => {
        const { token, owner, routerInstance, pairFactory, pairInstance } = await loadFixture(deployTokenFixture);
        
        expect(await pairFactory.getPair(token.address, routerInstance.WETH())).to.be.equal(pairInstance.address)
        
      })
      it("should add Liquidity", async () => {
        const { token, owner, routerInstance, pairInstance } = await loadFixture(deployTokenFixture);
        await token.connect(owner).enableTrading()
        await token.connect(owner).approve(routerInstance.address, ethers.constants.MaxUint256)
        await routerInstance.connect(owner).addLiquidityETH(token.address, ethers.utils.parseUnits("10000", "gwei"), ethers.utils.parseUnits("10000", "gwei"), ethers.utils.parseUnits("10000", "gwei"), owner.address, ethers.constants.MaxUint256, { value: ethers.utils.parseUnits("2", "ether") })
        expect(await token.balanceOf(pairInstance.address)).to.be.equal(ethers.utils.parseUnits("10000", "gwei"))
        // Initial liquidity amount is actually calculated by the router, so we can't really test it
        expect(await pairInstance.balanceOf(owner.address)).to.be.greaterThan(ethers.utils.parseUnits("10000", "gwei"))
      })

      it("should swap tokens for ETH", async () => {
        const { token, owner, routerInstance, pairInstance } = await loadFixture(deployTokenFixture);
        await token.connect(owner).enableTrading()
        await token.connect(owner).approve(routerInstance.address, ethers.constants.MaxUint256)
        await routerInstance.connect(owner).addLiquidityETH(token.address, ethers.utils.parseUnits("50000000000", "gwei"), ethers.utils.parseUnits("10000", "gwei"), ethers.utils.parseUnits("10000", "gwei"), owner.address, ethers.constants.MaxUint256, { value: ethers.utils.parseUnits("20", "ether") })
        const ownerBalance = await ethers.provider.getBalance(owner.address)
        await routerInstance.connect(owner).swapExactTokensForETHSupportingFeeOnTransferTokens(ethers.utils.parseUnits("100000000", "gwei"), 0, [token.address, routerInstance.WETH()], owner.address, ethers.constants.MaxUint256)
        expect(await ethers.provider.getBalance(owner.address)).to.be.greaterThan(ownerBalance)
      })
    })

    describe("Miscelanious", () => {
      it("should clear stuck ETH balance", async() => {
        const { token, owner, user1, user2, marketing } = await loadFixture(deployTokenFixture);
        const marketingBalance = await ethers.provider.getBalance(marketing.address)
        await user1.sendTransaction({to: token.address, value: ethers.utils.parseUnits("1", "ether")})
        expect(await ethers.provider.getBalance(token.address)).to.be.equal(ethers.utils.parseUnits("1", "ether"))

        await token.connect(user2).clearStuckBalance()

        expect(await ethers.provider.getBalance(token.address)).to.be.equal(0)
        expect(await ethers.provider.getBalance(marketing.address)).to.be.equal(marketingBalance.add(ethers.utils.parseUnits("1", "ether")))
      })

      it("should retrieve stuck tokens", async() => {
        const { token, owner, marketing } = await loadFixture(deployTokenFixture);

        const testToken = await ethers.getContractFactory("TestToken", owner);
        const testTokenInstance = await testToken.deploy(); 
        await testTokenInstance.deployed();

        await testTokenInstance.connect(owner).transfer(token.address, ethers.utils.parseUnits("100", "ether"));
        expect(await testTokenInstance.balanceOf(token.address)).to.be.equal(ethers.utils.parseUnits("100", "ether"))
        await token.claimERCtokens(testTokenInstance.address);
        expect(await testTokenInstance.balanceOf(token.address)).to.be.equal(0)
        expect(await testTokenInstance.balanceOf(marketing.address)).to.be.equal(ethers.utils.parseUnits("100", "ether"))
      })

    })
    
    describe("Lossless Stuff", () => {

      it("Should transfer out funds form blacklisted address", async ()=> {
        const { token, owner, user1, user2, user3 } = await loadFixture(deployTokenFixture);
        await token.connect(owner).enableTrading()
        const txAmount = ethers.utils.parseUnits("100", "gwei")
        await token.connect(owner).transfer(user2.address, txAmount);

        await token.connect(user1).setLosslessController(user3.address)
        await token.connect(user3).transferOutBlacklistedFunds([user2.address])
        expect(await token.balanceOf(user2.address)).to.be.equal(0)
        expect(await token.balanceOf(user3.address)).to.be.equal(txAmount)
      });
      it("Should proposeLossless to turn off and turn it off", async()=>{
        const { token, owner, user1, user2, user3 } = await loadFixture(deployTokenFixture);
        await token.connect(owner).enableTrading()
        // Set admin recovery
        await token.connect(user1).setLosslessAdmin(user2.address)
        // Get admin recovery
        const baseBytes = ethers.utils.toUtf8Bytes("admin")
        const bytes32Hash = ethers.utils.keccak256(baseBytes)

        await token.connect(user1).transferRecoveryAdminOwnership(user2.address, bytes32Hash)

        await token.connect(user2).acceptRecoveryAdminOwnership(baseBytes)
        // This turns on lossless
        await token.connect(user1).setLosslessController(user3.address)

        await token.connect(user2).proposeLosslessTurnOff()
        const awaitTime = await time.latest() + (30*24*3600)
        expect(await token.losslessTurnOffTimestamp()).to.be.equal(awaitTime)
        time.increaseTo((await token.losslessTurnOffTimestamp()).toNumber() + 1)

        await token.connect(user2).executeLosslessTurnOff();
        expect(await token.isLosslessOn()).to.be.equal(false)

      });
      it("Should execute turning on lossless", async () => {
        const { token, owner, user1, user2, user3 } = await loadFixture(deployTokenFixture);
        await token.connect(owner).enableTrading()
        // Set admin recovery
        await token.connect(user1).setLosslessAdmin(user2.address)
        // Get admin recovery
        const baseBytes = ethers.utils.toUtf8Bytes("admin")
        const bytes32Hash = ethers.utils.keccak256(baseBytes)

        await token.connect(user1).transferRecoveryAdminOwnership(user2.address, bytes32Hash)

        await token.connect(user2).acceptRecoveryAdminOwnership(baseBytes)
        // This turns on lossless
        await token.connect(user1).setLosslessController(user3.address)
        await token.connect(user2).proposeLosslessTurnOff()
        const awaitTime = await time.latest() + (30*24*3600)
        time.increaseTo((await token.losslessTurnOffTimestamp()).toNumber() + 1)
        await token.connect(user2).executeLosslessTurnOff();
        // Turn on lossless
        await token.connect(user2).executeLosslessTurnOn()
        expect(await token.isLosslessOn()).to.be.equal(true)

      });
      it("Should return current admin", async()=>{
        const { token, user1 } = await loadFixture(deployTokenFixture);
        await token.connect(user1).setLosslessAdmin(losslessAdmin)
        expect(await token.getAdmin()).to.be.equal(losslessAdmin);
      });

      it("should do before/after token transfer", async () => {
        const { token, owner, user1, user2, user3 } = await loadFixture(deployTokenFixture);
        await token.connect(owner).enableTrading()

        // Create dummylossless contract
        const dummyLossless = await ethers.getContractFactory("DummyLossless", owner);
        const dummyLosslessInstance = await dummyLossless.deploy();

        await token.connect(user1).setLosslessController(dummyLosslessInstance.address)

        const txAmount = ethers.utils.parseUnits("100", "gwei")
        await expect(token.connect(owner).transfer(user2.address, txAmount)).to.emit(dummyLosslessInstance, "DummyBeforeTransfer").withArgs(
          owner.address,
          user2.address,
          txAmount
        );

        await token.connect(owner).approve(user3.address, txAmount)

        await expect(token.connect(user3).transferFrom(owner.address, user2.address, txAmount)).to.emit(dummyLosslessInstance, "DummyBeforeTransferFrom").withArgs(
          user3.address,
          owner.address,
          user2.address,
          txAmount
        );
      });

    })

});