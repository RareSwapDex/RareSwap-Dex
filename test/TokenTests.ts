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
const depWalletAddress = "0x611980Ea951D956Bd04C39A5A176EaB35EB93982"
const routerAddress = "0x027bC3A29990aAED16F65a08C8cc3A92E0AFBAA4" // Rareswap Router
const uniswapV2Router = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"

describe("Token contract", function () {
    async function deployTokenFixture() {
      const [owner, user1, user2, user3, user4, marketing, antiques, gas, trusted, recoveryAdmin] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("TheRareAntiquitiesTokenLtd", owner);
        const token = await Token.deploy(marketing.address, antiques.address, gas.address, trusted.address, depWalletAddress, routerAddress, [owner.address, user1.address, user2.address, user3.address, user4.address]);
        await token.deployed();

        await token.connect(owner).transfer(user1.address, ethers.utils.parseUnits("5000", "gwei"))

        const routerInstance = await ethers.getContractAt("IRARESwapRouter", await token.rareSwapRouter())
        const pairFactory = await ethers.getContractAt("IRARESwapFactory", await routerInstance.factory())
        const pairInstance = await ethers.getContractAt("IRARESwapPair", await token.rareSwapPair())

        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [ethers.constants.AddressZero]
        });
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [depWalletAddress]
        });
        const zeroAddress = await ethers.getSigner(ethers.constants.AddressZero);
        const depWallet = await ethers.getSigner(depWalletAddress);

        return { token, owner, user1, user2, user3, user4, marketing, antiques, gas, trusted, recoveryAdmin, losslessV2Controller, losslessAdmin, keyHash, key, maxAmount, botWallet, routerInstance, pairInstance, pairFactory, zeroAddress, depWallet };
    }
    async function deployTokenFixtureWUniswap() {
      const [owner, user1, user2, user3, user4, marketing, antiques, gas, trusted, recoveryAdmin] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("TheRareAntiquitiesTokenLtd", owner);
        const token = await Token.deploy(marketing.address, antiques.address, gas.address, trusted.address, depWalletAddress, uniswapV2Router, [owner.address, user1.address, user2.address, user3.address, user4.address]);
        await token.deployed();

        await token.connect(owner).transfer(user1.address, ethers.utils.parseUnits("5000", "gwei"))

        const routerInstance = await ethers.getContractAt("IRARESwapRouter", await token.rareSwapRouter())
        const pairFactory = await ethers.getContractAt("IRARESwapFactory", await routerInstance.factory())
        const pairInstance = await ethers.getContractAt("IRARESwapPair", await token.rareSwapPair())

        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [ethers.constants.AddressZero]
        });
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [depWalletAddress]
        });
        const zeroAddress = await ethers.getSigner(ethers.constants.AddressZero);
        const depWallet = await ethers.getSigner(depWalletAddress);

        return { token, owner, user1, user2, user3, user4, marketing, antiques, gas, trusted, recoveryAdmin, losslessV2Controller, losslessAdmin, keyHash, key, maxAmount, botWallet, routerInstance, pairInstance, pairFactory, zeroAddress, depWallet };
    }

    describe("Deployment", function () {
        it("Should fail with wrong configs", async ()=> {
          const [owner, user1, user2, user3, user4, marketing, antiques, gas, trusted, recoveryAdmin] = await ethers.getSigners();
          const Token = await ethers.getContractFactory("TheRareAntiquitiesTokenLtd", owner);
    
          await expect(Token.deploy(marketing.address, antiques.address, gas.address, trusted.address, depWalletAddress, routerAddress, [owner.address, user1.address, user2.address, user3.address])).to.be.revertedWith("ERR: INVALID_ADMIN_ROLES");
        })
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
        const { token, owner, user1, zeroAddress } = await loadFixture(deployTokenFixture);

        expect(await token.allowance(owner.address, user1.address)).to.equal(0);
        const amount = ethers.utils.parseUnits('1000', 'gwei')
        // Owner approves user1 to spend 1000 tokens
        await token.connect(owner).approve(user1.address, amount);
        
        expect(await token.allowance(owner.address, user1.address)).to.equal(amount);
        await expect( token.connect(owner).approve(ethers.constants.AddressZero, amount )).to.be.revertedWith("ERC20: approve to the zero address")
        // impersonate address 0
        
        await expect( token.connect(zeroAddress).approve(user1.address, amount )).to.be.revertedWith("ERC20: approve from the zero address")
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
            const { token, user1, user2, recoveryAdmin, keyHash, key} = await loadFixture(deployTokenFixture);
            await token.connect(user1).transferRecoveryAdminOwnership(recoveryAdmin.address, keyHash);
            await expect(token.connect(user2).acceptRecoveryAdminOwnership(key)).to.be.revertedWith("LERC20: Must be candidate")
            await expect(token.connect(recoveryAdmin).acceptRecoveryAdminOwnership("0x1234567890")).to.be.revertedWith("LERC20: Invalid key")
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
            expect(token.connect(owner).setMaxTxAmount(maxAmount.sub(1))).to.be.revertedWith("ERR: max wallet amount should exceed 0.5% of the supply")
          })
          it("should succeed", async () => {
            const { token, owner, user1, user2, maxAmount } = await loadFixture(deployTokenFixture);
            await token.connect(owner).setMaxTxAmount(maxAmount.mul(2))
            expect(await token._maxTxAmount()).to.be.equal(maxAmount.mul(2).mul(10**9))
            // This should succeed since owner
            await token.connect(owner).transfer(user1.address, maxAmount.mul(2).mul(10**9).add(1))
            // This should fail since user1
            await expect(token.connect(user1).transfer(user2.address, maxAmount.mul(2).mul(10**9).add(1))).to.be.revertedWith("Transfer amount exceeds the maxTxAmount.")
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
            const { token, owner, user4, botWallet, marketing, antiques, gas, pairInstance } = await loadFixture(deployTokenFixture);
            
            await expect(token.connect(user4).addBotWallet( pairInstance.address)).to.be.revertedWith("Cannot add pair as a bot");
            await expect(token.connect(user4).addBotWallet( token.address )).to.be.revertedWith("Cannot add CA as a bot");
            await expect(token.connect(user4).addBotWallet( await token.owner() )).to.be.revertedWith("Owner not bot");
            await token.connect(owner).renounceOwnership();
            await expect(token.connect(user4).addBotWallet( marketing.address )).to.be.revertedWith("Dep not bot");
            await expect(token.connect(user4).addBotWallet( antiques.address )).to.be.revertedWith("Dep not bot");
            await expect(token.connect(user4).addBotWallet( gas.address )).to.be.revertedWith("Dep not bot");
            await expect(token.connect(user4).addBotWallet( "0x611980Ea951D956Bd04C39A5A176EaB35EB93982" )).to.be.revertedWith("Dep not bot");
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

            await expect( token.connect(user2).excludeFromFee(user1.address)).to.be.revertedWith("Account is already excluded")
            await expect( token.connect(user2).excludeFromFee(ethers.constants.AddressZero)).to.be.revertedWith("excludeFromFee: ZERO")
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
            await expect( token.connect(owner).excludeFromReward(user2.address)).to.be.revertedWith("Account is already excluded")
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

            await expect( token.connect(user2).includeInFee(marketing.address)).to.be.revertedWith("Account is already included")
            await expect( token.connect(user2).includeInFee(ethers.constants.AddressZero)).to.be.revertedWith("includeInFee: ZERO")
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

            await expect( token.connect(user3).setAntiquitiesWallet(ethers.constants.AddressZero)).to.be.revertedWith("antiqueWallet: ZERO")
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

            await expect( token.connect(user3).setGasWallet(ethers.constants.AddressZero)).to.be.revertedWith("gasWallet: ZERO")
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

            await expect( token.connect(user3).setMarketingWallet(ethers.constants.AddressZero)).to.be.revertedWith("mkWallet: ZERO")
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

          await expect(token.connect(user2).setFees(1000, 300, 300, 100)).to.be.revertedWith("total tax cannot exceed 15%")
          await expect(token.connect(user2).setFees(10, 30, 30, 10)).to.be.revertedWith("ERR: marketing + antiquities + gas tax must be over 1%")
        })
        it("Should succeed changing fees if uniswap", async () => {
          const { token, user2 } = await loadFixture(deployTokenFixtureWUniswap);
          await expect(token.connect(user2).setFees(100, 100, 100, 100)).to.emit(token, "Log").withArgs("Cant update fee", 300)
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
          await expect(token.connect(user3).transfer(user1.address, transferAmount)).to.be.revertedWith("bots arent allowed to trade")
          // await token.connect(user4).
        })

        describe("when sender is excluded from fee", () => {

          it("should succeed", async () => {
            const { token, owner, user1, user2, user3, zeroAddress } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(user2).excludeFromFee(user1.address)
            await token.connect(user1).transfer(user3.address, transferAmount)
            expect(await token.balanceOf(user3.address)).to.be.equal(transferAmount)

            await expect(token.connect(owner).transfer(ethers.constants.AddressZero, transferAmount)).to.be.revertedWith("ERC20: transfer to the zero address")
            await expect(token.connect(zeroAddress).transfer(user1.address, transferAmount)).to.be.revertedWith("ERC20: transfer from the zero address")

          })
          it("shoud succeed if taxes are 0", async () => {
            const { token, owner, user1, user2, user3, zeroAddress } = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(user2).excludeFromFee(user1.address)
            // set fees to 0
            await token.connect(user2).setFees(0, 100, 100, 100)
            await token.connect(user1).transfer(user3.address, transferAmount)
            expect(await token.balanceOf(user3.address)).to.be.equal(transferAmount)

            await expect(token.connect(owner).transfer(ethers.constants.AddressZero, transferAmount)).to.be.revertedWith("ERC20: transfer to the zero address")
            await expect(token.connect(zeroAddress).transfer(user1.address, transferAmount)).to.be.revertedWith("ERC20: transfer from the zero address")
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

          describe("and receiver is excluded from fee", () => {
            it("should succeed", async () => {
              const { token, owner, user1, user2, user3, zeroAddress } = await loadFixture(deployTokenFixture);
              await token.connect(owner).enableTrading()
              await token.connect(user2).excludeFromFee(user3.address)
              await token.connect(user1).transfer(user3.address, transferAmount)
              expect(await token.balanceOf(user3.address)).to.be.equal(transferAmount)
            })
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
            const { token,owner, user1, user2, marketing} = await loadFixture(deployTokenFixture);
            await token.connect(owner).enableTrading()
            await token.connect(user1).transfer(user2.address, transferAmount);
            const fees = await token.totalFees();
            const burnAmount = fees.div(10);
            console.log({fees, burnAmount})
            await token.connect(user1).deliver(burnAmount);
            await expect(token.connect(marketing).deliver(burnAmount)).to.be.revertedWith("Excluded addresses cannot call this function");
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

      it("should swap ETH for tokens since it goes above max wallet", async () => {
        const { token, owner, routerInstance, pairInstance, user1 } = await loadFixture(deployTokenFixtureWUniswap);
        await token.connect(owner).enableTrading()
        await token.connect(owner).approve(routerInstance.address, ethers.constants.MaxUint256)
        await routerInstance.connect(owner).addLiquidityETH(token.address, ethers.utils.parseUnits("50000000000", "gwei"), ethers.utils.parseUnits("10000", "gwei"), ethers.utils.parseUnits("10000", "gwei"), owner.address, ethers.constants.MaxUint256, { value: ethers.utils.parseUnits("100", "ether") })

        await expect( routerInstance.connect(owner).swapExactETHForTokensSupportingFeeOnTransferTokens(0, [routerInstance.WETH(), token.address], owner.address, ethers.constants.MaxUint256, { value: ethers.utils.parseUnits("1", "ether") })).to.be.revertedWith("UniswapV2: TRANSFER_FAILED");
        const prevBalance = await token.balanceOf(user1.address);
        await routerInstance.connect(user1).swapExactETHForTokensSupportingFeeOnTransferTokens(0, [routerInstance.WETH(), token.address], user1.address, (await time.latest()) + 3600, { value: ethers.utils.parseUnits("0.00000001", "ether") })
        expect(await token.balanceOf(user1.address)).to.be.greaterThan(prevBalance);
      })
    })

    describe("Miscelanious", () => {
      it("Should calculate reflections", async () => {
        const { token, owner } = await loadFixture(deployTokenFixture);
        const amount = ethers.utils.parseUnits("1000", "gwei");
        const reflectionAmount = await token.reflectionFromToken(amount, true);
        expect( await token.tokenFromReflection(reflectionAmount)).to.be.lessThan(amount);
        const reflectionWithFees = await token.reflectionFromToken(amount, false);
        expect( await token.tokenFromReflection(reflectionWithFees)).to.be.equal(amount);

        const totalSupply = await token.totalSupply();
        await expect(token.reflectionFromToken( totalSupply.add(amount), false)).to.be.revertedWith("Amount must be less than supply")
        await expect(token.tokenFromReflection( ethers.constants.MaxUint256)).to.be.revertedWith("Amount must be less than total reflections")
      })
      it("should fail to clear stuck ETH balance", async() => {
        const { token, owner, user1, user2, user3, marketing } = await loadFixture(deployTokenFixture);
        const marketingBalance = await ethers.provider.getBalance(marketing.address)
        await user1.sendTransaction({to: token.address, value: ethers.utils.parseUnits("1", "ether")})
        expect(await ethers.provider.getBalance(token.address)).to.be.equal(ethers.utils.parseUnits("1", "ether"))

        const testToken = await ethers.getContractFactory("TestToken", owner);
        const testTokenInstance = await testToken.deploy(); 
        await testTokenInstance.deployed();

        await token.connect(user3).setMarketingWallet(testTokenInstance.address)
        await expect( token.connect(user2).clearStuckBalance()).to.be.revertedWith("Transfer failed.")
      })
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
      it("should fail to retrieve stuck tokens", async() => {
        const { token, owner, marketing } = await loadFixture(deployTokenFixture);

        const testToken = await ethers.getContractFactory("TestToken", owner);
        const testTokenInstance = await testToken.deploy(); 
        await testTokenInstance.deployed();
        await testTokenInstance.connect(owner).setForbidden(marketing.address);
        await testTokenInstance.connect(owner).transfer(token.address, ethers.utils.parseUnits("100", "ether"));
        await expect(token.claimERCtokens(testTokenInstance.address)).to.be.revertedWith("Transfer failed.");
      })

      it("should fail when trying to add deposit LP Fees", async () => {
        const { token, owner, user1, user2, marketing,  } = await loadFixture(deployTokenFixture);
        const testToken = await ethers.getContractFactory("TestToken", owner);
        const testTokenInstance = await testToken.deploy(); 
        await testTokenInstance.deployed();
        await expect(token.connect(user1).depositLPFee(ethers.utils.parseUnits("1", "ether"), testTokenInstance.address)).to.be.revertedWith("RARE: NOT_ALLOWED")
      })

      it("Should distribute LP fees appropriately when called directly", async () => {
        const { token, owner, user1, user2, marketing, routerInstance, gas, antiques  } = await loadFixture(deployTokenFixture);
        const testToken = await ethers.getContractFactory("TestToken", owner);
        const testTokenInstance = await testToken.deploy(); 
        await testTokenInstance.deployed();

        const routerAsAccount = await ethers.getImpersonatedSigner(routerInstance.address)
        const WETHasAccount = await ethers.getImpersonatedSigner(await routerInstance.WETH())
        await WETHasAccount.sendTransaction({to: routerAsAccount.address, value: ethers.utils.parseUnits("1", "ether")})
        await testTokenInstance.connect(owner).transfer(routerInstance.address, ethers.utils.parseUnits("100", "ether"))
        // Without approval it wont fail, but also wont deposit anything
        await token.connect(routerAsAccount).depositLPFee(ethers.utils.parseUnits("100", "ether"), testTokenInstance.address)
        expect(await testTokenInstance.balanceOf(marketing.address)).to.be.equal(0)
        expect(await testTokenInstance.balanceOf(gas.address)).to.be.equal(0)
        expect(await testTokenInstance.balanceOf(antiques.address)).to.be.equal(0)

        await testTokenInstance.connect(routerAsAccount).approve(token.address, ethers.constants.MaxUint256)
        await token.connect(routerAsAccount).depositLPFee(ethers.utils.parseUnits("100", "ether"), testTokenInstance.address)
        
        expect(await testTokenInstance.balanceOf(marketing.address)).to.be.lte(ethers.utils.parseUnits(((100 * 200) / 600).toString(), "ether"))
        expect(await testTokenInstance.balanceOf(gas.address)).to.be.lte(ethers.utils.parseUnits(((100 * 100) / 600).toString(), "ether"))
        expect(await testTokenInstance.balanceOf(antiques.address)).to.be.lte(ethers.utils.parseUnits(((100 * 300) / 600).toString(), "ether"))

      })

    })
    
    describe("Lossless Stuff", () => {

      it("Should transfer out funds form blacklisted address", async ()=> {
        const { token, owner, user1, user2, user3 } = await loadFixture(deployTokenFixture);
        await token.connect(owner).enableTrading()
        const txAmount = ethers.utils.parseUnits("100", "gwei")
        await token.connect(owner).transfer(user2.address, txAmount);

        await token.connect(user1).setLosslessController(user3.address)
        await expect(token.connect(user1).transferOutBlacklistedFunds([user2.address])).to.be.revertedWith("LERC20: Only lossless contract")
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

        await expect(token.connect(owner).proposeLosslessTurnOff()).to.be.revertedWith("LERC20: Must be recovery admin")

        await expect(token.connect(owner).executeLosslessTurnOff()).to.be.revertedWith("LERC20: Must be recovery admin")
        await expect(token.connect(user2).executeLosslessTurnOff()).to.be.revertedWith("LERC20: TurnOff not proposed")

        await token.connect(user2).proposeLosslessTurnOff()
        const awaitTime = await time.latest() + (30*24*3600)
        expect(await token.losslessTurnOffTimestamp()).to.be.equal(awaitTime)
        await expect(token.connect(user2).proposeLosslessTurnOff()).to.be.revertedWith("LERC20: TurnOff already proposed");
        await expect(token.connect(user2).executeLosslessTurnOff()).to.be.revertedWith("LERC20: Time lock in progress");
        time.increaseTo((await token.losslessTurnOffTimestamp()).toNumber() + 1)

        await token.connect(user2).executeLosslessTurnOff();
        expect(await token.isLosslessOn()).to.be.equal(false)
        await expect(token.connect(user2).proposeLosslessTurnOff()).to.be.revertedWith("LERC20: Lossless already off");


      });
      it("Should execute turning on lossless", async () => {
        const { token, owner, user1, user2, user3 } = await loadFixture(deployTokenFixture);
        await token.connect(owner).enableTrading()
        // Set admin recovery
        await expect(token.connect(user1).setLosslessAdmin(ethers.constants.AddressZero)).to.be.revertedWith("LERC20: Cannot set same address");
        await token.connect(user1).setLosslessAdmin(user2.address)
        // Get admin recovery
        const baseBytes = ethers.utils.toUtf8Bytes("admin")
        const bytes32Hash = ethers.utils.keccak256(baseBytes)

        await token.connect(user1).transferRecoveryAdminOwnership(user2.address, bytes32Hash)

        await token.connect(user2).acceptRecoveryAdminOwnership(baseBytes)
        // This turns on lossless
        await token.connect(user1).setLosslessController(user3.address)
        // Test other require
        await expect(token.connect(user1).setLosslessController(user3.address)).to.be.revertedWith("BridgeMintableToken: Cannot set same address.");
        await token.connect(user2).proposeLosslessTurnOff()
        const awaitTime = await time.latest() + (30*24*3600)
        time.increaseTo((await token.losslessTurnOffTimestamp()).toNumber() + 1)
        await token.connect(user2).executeLosslessTurnOff();
        // Turn on lossless
        await token.connect(user2).executeLosslessTurnOn()
        expect(await token.isLosslessOn()).to.be.equal(true)
        await expect(token.connect(owner).executeLosslessTurnOn()).to.be.revertedWith("LERC20: Must be recovery admin");
        await expect(token.connect(user2).executeLosslessTurnOn()).to.be.revertedWith("LERC20: Lossless already on");
        await token.connect(user1).setLosslessController(user2.address)
        expect(await token.lossless()).to.be.eq(user2.address)

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
        expect(await token.isLosslessOn()).to.equal(true)
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

    describe("RateSupply Tests", () => {
      it("should run this a couple of times", async () => {
        const { token, owner, user1, user2 } = await loadFixture(deployTokenFixture);
        await token.connect(owner).enableTrading()
        // Highest fees
        await token.connect(user2).setFees(1400, 100, 0, 0)
        await token.connect(owner).transfer(user1.address, await token.balanceOf(owner.address))
        const maxTx = await token._maxTxAmount()
        for(let i = 0; i < 500; i++){
          let bal = await token.balanceOf(user1.address)
          console.log('u1 to u2', i, bal)
          await token.connect(user1).transfer(user2.address, bal.gt(maxTx) ? maxTx : bal)
          // if(i == 200)
          //   await token.connect(owner).excludeFromReward(user2.address)
          bal = await token.balanceOf(user2.address)
          console.log('bal u2', ethers.utils.formatEther(bal))
          console.log('u2 to u1', i)
          await token.connect(user2).transfer(user1.address, bal.gt(maxTx) ? maxTx : bal)
        }
        
        // get reflection tokesn
        await token.tokenFromReflection(ethers.utils.parseEther("100" ));
      })
    })

});