/*
    Website: 
    Contract Name: Rare Dex Swap
    Instagram:
    Twitter: 
    Telegram: 
    Contract Version: 0.1
    removed safemath
    fixed storage
    fixed swc
    fixed Libraries.
    fixed documentation of code.


*/
//SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.17;
//Libraries from OpenZeppelin to be included in the code, these Libraries are secured and used here without modification.
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "../interfaces/IRareDex.sol";
import "../interfaces/ILERC20.sol";

contract TheRareAntiquitiesTokenLtd is
    ERC2771Context,
    ILERC20,
    AccessControl,
    Ownable
{
    // Roles
    // Roles can only be added by members of the same role
    // Owner can set the role, ONLY when the role is not setup
    bytes32 public constant FEE_ROLE = keccak256("FEE");
    bytes32 public constant WALLET_ROLE = keccak256("WALLET");
    bytes32 public constant LOSSLESS_ROLE = keccak256("LOSSLESS");
    bytes32 public constant MAX_ROLE = keccak256("MAX");
    bytes32 public constant BOT_ROLE = keccak256("BOT");
    //Inclusion of address library into our code for simplicity.
    using Address for address;
    ///all mappings documented in this section
    mapping(address => uint256) private _rOwned;
    mapping(address => uint256) private _tOwned;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) private _isExcludedFromFee;
    mapping(address => bool) private _isExcluded;
    mapping(address => bool) private botWallets;
    //events documented here so they are recorded in the chain, later this are called on the functions.
    event Log(string, uint256);
    event AuditLog(string, address);

    //Wrapped Token from chain defined and wallets definition for code.
    address public immutable WETH;
    address public marketingWallet; // marketing wallet address
    address public antiquitiesWallet; // antiquities Wallet address
    address public gasWallet; // gas Wallet address
    address public immutable depWallet; // dep Wallet address

    // Exclusion amounts
    uint private excludedT;
    uint private excludedR;
    //Trade Definition
    bool public botsCantrade = false;
    bool public canTrade = false;
    //Token Information, including name, symbol and supply
    uint256 private constant MAX = ~uint256(0);
    uint256 private _tTotal = 500_000_000_000 gwei;
    uint256 private _rTotal = (MAX - (MAX % _tTotal));
    uint256 private _tFeeTotal;
    string public constant name = "The Rare Antiquities Token";
    string public constant symbol = "TRAT";
    uint8 public constant decimals = 9;
    //Tax Definition for code and public reference.
    uint256 private _taxFee = 100; // reflection tax in BPS
    uint256 private _previousTaxFee = _taxFee;

    uint256 private _liquidityFee; // liquidity tax in BPS
    uint256 private _previousLiquidityFee = _liquidityFee;

    uint256 private _marketingFee = 200; // marketing tax in BPS | 200 = 2%
    uint256 private _antiquitiesFee = 300; // antiquities tax in BPS
    uint256 private _gasFee = 100; // gas tax in BPS

    uint256 public _totalTax =
        _taxFee + _marketingFee + _antiquitiesFee + _gasFee; //Total Tax to be collected.
    //Swap and Router definition for the code and pair creation.addmod
    IRARESwapRouter public immutable rareSwapRouter;
    address public immutable rareSwapPair;
    //Max Limits Definition
    uint256 public _maxTxAmount = 500_000_000_000 gwei; // total supply by default, can be changed at will
    uint256 public _maxWallet = 5_000_000_000 gwei; // 1% max wallet by default, can be changed at will

    /// Lossless Compliance
    //You can read more on https://docs.lossless.io/protocol/technical-reference/hack-mitigation-protocol
    address public admin;
    address public recoveryAdmin;
    address private recoveryAdminCandidate;
    bytes32 private recoveryAdminKeyHash;
    uint256 public timelockPeriod = 30 days;
    uint256 public losslessTurnOffTimestamp;
    bool public isLosslessOn = false;
    ILssController public lossless;
    //Modifier to identify pair and ensure is only RareSwap
    modifier onlyExchange() {
        bool isPair = false;
        if (msg.sender == rareSwapPair) isPair = true;

        require(
            msg.sender == address(rareSwapRouter) || isPair,
            "RARE: NOT_ALLOWED"
        );
        _;
    }

    //Code Deployer Configuration for wallets, these wallets are used to collect taxes.
    constructor(
        address _marketingWallet,
        address _antiquitiesWallet,
        address _gasWallet,
        address _trustedForwarder,
        address[] memory adminRoles
    ) ERC2771Context(_trustedForwarder) {
        _rOwned[_msgSender()] = _rTotal;
        _tOwned[_msgSender()] = _tTotal;

        marketingWallet = _marketingWallet;
        antiquitiesWallet = _antiquitiesWallet;
        gasWallet = _gasWallet;

        // Setup router
        rareSwapRouter = IRARESwapRouter(
            0x027bC3A29990aAED16F65a08C8cc3A92E0AFBAA4
        );
        WETH = rareSwapRouter.WETH();
        // Create the pair
        rareSwapPair = IRARESwapFactory(rareSwapRouter.factory()).createPair(
            address(this),
            WETH
        );
        // Set base token in the pair as WETH, which acts as the tax token
        IRARESwapPair(rareSwapPair).setBaseToken(WETH);
        require(
            IRARESwapPair(rareSwapPair).updateTotalFee(
                _marketingFee + _antiquitiesFee + _gasFee
            ),
            "FEE_UPDATE_FAILED"
        );

        depWallet = 0x611980Ea951D956Bd04C39A5A176EaB35EB93982;
        //exclude owner and this contract from fee
        //exclude definition to avoid problems with swap,router and owner or marketing wallets from getting fees.

        _isExcludedFromFee[owner()] = true;
        _isExcludedFromFee[address(this)] = true;
        _isExcludedFromFee[depWallet] = true;
        _isExcludedFromFee[gasWallet] = true;
        _isExcludedFromFee[marketingWallet] = true;
        _isExcludedFromFee[antiquitiesWallet] = true;
        //exclude from getting reflections.
        excludeFromReward(address(this));
        excludeFromReward(depWallet);
        excludeFromReward(gasWallet);
        excludeFromReward(marketingWallet);
        excludeFromReward(antiquitiesWallet);
        excludeFromReward(rareSwapPair);
        excludeFromReward(address(rareSwapRouter));
        //define those that Have permissions using access roles.
        require(adminRoles.length == 5, "ERR: INVALID_ADMIN_ROLES");
        _grantRole(MAX_ROLE, adminRoles[0]);
        _grantRole(LOSSLESS_ROLE, adminRoles[1]);
        _grantRole(FEE_ROLE, adminRoles[2]);
        _grantRole(WALLET_ROLE, adminRoles[3]);
        _grantRole(BOT_ROLE, adminRoles[4]);
        //transfer tokens to owner after mint or creation
        emit Transfer(address(0), _msgSender(), _tTotal);
    }

    /// @notice set the Maximum amount of tokens that can be held in a wallet
    /// @param amount the amount of tokens in gwei
    /// @dev only owner can call this function, minimum limit is 0.5% of the total supply
    function setMaxWalletAmount(uint256 amount) external onlyRole(MAX_ROLE) {
        require(
            amount > 2_500_000_000,
            "ERR: max wallet amount should exceed 0.5% of the supply"
        );
        _maxWallet = amount * 10 ** 9;
        emit Log("New max wallet amount:", amount);
    }

    /// @notice ERC20 implementation of total Circulating supply of the token
    /// @return _tTotal total supply of the token
    function totalSupply() public view override returns (uint256) {
        return _tTotal;
    }

    /// @notice ERC20 implementation of user's balance
    /// @param account the address of the user to check
    /// @return balance of the user
    /// @dev if the address is excluded from reward, it returns the balance of the user without any reflections accounted for
    function balanceOf(address account) public view override returns (uint256) {
        if (_isExcluded[account]) return _tOwned[account];
        return tokenFromReflection(_rOwned[account]);
    }

    /// @notice ERC20 implementation of transfer function
    /// @param recipient the address of the recipient
    /// @param amount the amount of tokens to transfer
    /// @return true if the transfer is successful
    function transfer(
        address recipient,
        uint256 amount
    ) public override lssTransfer(recipient, amount) returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    /// @notice ERC20 implementation of allowance function
    /// @param _owner the address of the owner
    /// @param spender the address of the spender
    /// @return amount of tokens that the spender is allowed to spend
    function allowance(
        address _owner,
        address spender
    ) public view override returns (uint256) {
        return _allowances[_owner][spender];
    }

    /// @notice ERC20 implementation of approve function
    /// @param spender the address of the spender
    /// @param amount the amount of tokens to approve
    /// @return true if the approval is successful
    function approve(
        address spender,
        uint256 amount
    ) public override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    /// @notice ERC20 implementation of transferFrom function
    /// @param sender the address of the sender
    /// @param recipient the address of the recipient
    /// @param amount the amount of tokens to transfer
    /// @return true if the transfer is successful
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    )
        public
        override
        lssTransferFrom(sender, recipient, amount)
        returns (bool)
    {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            _msgSender(),
            _allowances[sender][_msgSender()] - amount
        );
        return true;
    }

    /// @notice ERC20 implementation of increaseAllowance function
    /// @param spender the address of the spender
    /// @param addedValue the amount of tokens to increase the allowance by
    /// @return true if the increase is successful
    function increaseAllowance(
        address spender,
        uint256 addedValue
    ) public virtual returns (bool) {
        _approve(
            _msgSender(),
            spender,
            _allowances[_msgSender()][spender] + addedValue
        );
        return true;
    }

    /// @notice ERC20 implementation of decreaseAllowance function
    /// @param spender the address of the spender
    /// @param subtractedValue the amount of tokens to decrease the allowance by
    /// @return true if the decrease is successful
    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public virtual returns (bool) {
        _approve(
            _msgSender(),
            spender,
            _allowances[_msgSender()][spender] - subtractedValue
        );
        return true;
    }

    /// @notice function that determines if an address is excluded from reward
    /// @param account the address to check
    /// @return true if the address is excluded from reward
    function isExcludedFromReward(address account) public view returns (bool) {
        return _isExcluded[account];
    }

    /// @notice function that returns the amount collected in fees
    /// @return the amount collected in fees
    function totalFees() public view returns (uint256) {
        return _tFeeTotal;
    }

    /// @notice this works similar to burn function
    /// @param tAmount the amount of tokens to deliver
    /// @dev although this function does not reduce the total supply, it reduces the reflection of the sender and the total to be distributed
    function deliver(uint256 tAmount) public {
        address sender = _msgSender();
        require(
            !_isExcluded[sender],
            "Excluded addresses cannot call this function"
        );
        (uint256 rAmount, , , , ) = _getValues(tAmount);
        _rOwned[sender] = _rOwned[sender] - rAmount;
        _rTotal = _rTotal - rAmount;
        _tFeeTotal = _tFeeTotal + tAmount;
    }

    /// @notice calcualtes the reflection amount from a given token amount
    /// @param tAmount the amount of tokens to calculate the reflection amount from
    /// @param deductTransferFee true if the transfer fee should be deducted
    /// @return the reflection amount
    function reflectionFromToken(
        uint256 tAmount,
        bool deductTransferFee
    ) public view returns (uint256) {
        require(tAmount <= _tTotal, "Amount must be less than supply");
        (uint256 rAmount, uint256 rTransferAmount, , , ) = _getValues(tAmount);
        return deductTransferFee ? rTransferAmount : rAmount;
    }

    /// @notice calculates the token amount from a given reflection amount
    /// @param rAmount the amount of reflections to calculate the token amount from
    /// @return the token amount
    function tokenFromReflection(
        uint256 rAmount
    ) public view returns (uint256) {
        require(
            rAmount <= _rTotal,
            "Amount must be less than total reflections"
        );
        uint256 currentRate = _getRate();
        return rAmount / currentRate;
    }

    /// @notice excludes an address from reward
    /// @param account the address to exclude from reward
    /// @dev this function can only be called by the owner and the variables for excluded amounts are updated
    function excludeFromReward(address account) public onlyOwner {
        // require(account != 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D, 'We can not exclude Uniswap router.');
        require(!_isExcluded[account], "Account is already excluded");
        if (_rOwned[account] > 0) {
            _tOwned[account] = tokenFromReflection(_rOwned[account]);
        }
        _isExcluded[account] = true;
        excludedT += _tOwned[account];
        excludedR += _rOwned[account];
    }

    /// @notice updates the Fees set up in the DEX pairs
    /// @param fee the new fee amount to update
    function _updatePairsFee(uint256 fee) internal {
        require(
            IRARESwapPair(rareSwapPair).updateTotalFee(fee),
            "FEE_UPDATE_FAILED"
        );
    }

    /// @notice excludes and address from transfer fees
    /// @param account the address to exclude from transfer fees
    /// @dev this function can only be called by the owner
    function excludeFromFee(address account) public onlyRole(FEE_ROLE) {
        require(account != address(0), "excludeFromFee: ZERO");
        require(!_isExcludedFromFee[account], "Account is already excluded");
        _isExcludedFromFee[account] = true;
        emit AuditLog("We have Updated the excludeFromFee:", account);
    }

    /// @notice includes an address in transfer fees
    /// @param account the address to include in transfer fees
    /// @dev this function can only be called by the owner
    function includeInFee(address account) public onlyRole(FEE_ROLE) {
        require(account != address(0), "includeInFee: ZERO");
        require(_isExcludedFromFee[account], "Account is already included");
        _isExcludedFromFee[account] = false;
        emit AuditLog("We have Updated the includeInFee:", account);
    }

    /// @notice sets the marketing wallet address
    /// @param walletAddress the address of the new marketing wallet
    /// @dev this function can only be called by the owner
    function setMarketingWallet(
        address walletAddress
    ) public onlyRole(WALLET_ROLE) {
        require(walletAddress != address(0), "includeInFee: ZERO");
        marketingWallet = walletAddress;
        emit AuditLog("We have Updated the setMarketingWallet:", walletAddress);
    }

    /// @notice sets the antiquities Wallet address
    /// @param walletAddress the address of the new antiquities wallet
    /// @dev this function can only be called by the owner
    function setAntiquitiesWallet(
        address walletAddress
    ) public onlyRole(WALLET_ROLE) {
        require(walletAddress != address(0), "includeInFee: ZERO");
        antiquitiesWallet = walletAddress;
        emit AuditLog(
            "We have Updated the setAntiquitiesWallet:",
            walletAddress
        );
    }

    /// @notice sets the gas Wallet address
    /// @param walletAddress the address of the new gas wallet
    /// @dev this function can only be called by the owner
    function setGasWallet(address walletAddress) public onlyRole(WALLET_ROLE) {
        require(walletAddress != address(0), "includeInFee: ZERO");
        gasWallet = walletAddress;
        emit AuditLog("We have Updated the gasWallet:", walletAddress);
    }

    /// @notice sets the Maximum transaction token transfer limit
    /// @param amount the amount of tokens to set the maximum transaction limit to
    /// @dev this function can only be called by the owner, the amount must be greater than 0.5% of the total supply
    function setMaxTxAmount(uint256 amount) external onlyRole(MAX_ROLE) {
        require(
            amount >= 2_500_000_000,
            "ERR: max tx amount should exceed 0.5% of the supply"
        );
        _maxTxAmount = amount * 10 ** 9;
        emit Log("New Max Transfer Amount:", amount);
    }

    /// @notice sends any stuck ETH balance to the marketing wallet
    /// @dev No matter who calls this function, it always is allocated to marketing wallet
    function clearStuckBalance() public {
        uint256 balance = address(this).balance;
        (bool succ, ) = payable(marketingWallet).call{value: balance}("");
        require(succ, "Transfer failed.");
    }

    /// @notice implementation of Context msgSender
    /// @return the sender of the transaction
    /// @dev this is mostly for the lossless and gasless stuff
    function _msgSender()
        internal
        view
        override(Context, ERC2771Context)
        returns (address)
    {
        return ERC2771Context._msgSender();
    }

    /// @notice implementation of Context msgData
    /// @return the data of the transaction
    /// @dev this is mostly for the lossless and gasless stuff
    function _msgData()
        internal
        view
        override(Context, ERC2771Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }

    /// @notice claim ERC20 tokens sent to this contract
    /// @param tokenAddress the address of the ERC20 token to claim
    /// @dev no matter who calls this function, funds are always sent to marketing wallet
    function claimERCtokens(IERC20 tokenAddress) external {
        bool succ = tokenAddress.transfer(
            marketingWallet,
            tokenAddress.balanceOf(address(this))
        );
        require(succ, "Transfer failed.");
    }

    /// @notice add a bot wallet to stop from trading and selling
    /// @param botwallet the address of the bot wallet to add
    /// @dev this function can only be called by the owner
    function addBotWallet(address botwallet) external onlyRole(BOT_ROLE) {
        require(botwallet != rareSwapPair, "Cannot add pair as a bot");
        require(botwallet != address(this), "Cannot add CA as a bot");
        if (owner() != address(0))
            require(botwallet != owner(), "Owner not bot");
        require(botwallet != depWallet, "Dep not bot");
        require(botwallet != marketingWallet, "Dep not bot");
        require(botwallet != antiquitiesWallet, "Dep not bot");
        require(botwallet != gasWallet, "Dep not bot");
        botWallets[botwallet] = true;
    }

    /// @notice remove a wallet from being a bot
    /// @param botwallet the address of the bot wallet to remove
    /// @dev this function can only be called by the owner
    function removeBotWallet(address botwallet) external onlyRole(BOT_ROLE) {
        botWallets[botwallet] = false;
    }

    /// @notice check if a wallet is a bot
    /// @param botwallet the address of the bot wallet to check
    /// @return true if the wallet is a bot, false otherwise
    function getBotWalletStatus(address botwallet) public view returns (bool) {
        return botWallets[botwallet];
    }

    /// @notice Enables trading for the contract
    /// @dev this function can only be called by the owner and once called, trading cannot be stopped
    function enableTrading() external onlyOwner {
        canTrade = true;
    }

    /// @notice Set the new tax amounts
    /// @param _reflectionTaxBPS the amount of tax to be taken for reflections
    /// @param _marketingTaxBPS the amount of tax to be taken for marketing
    /// @param _antiquitiesTaxBPS the amount of tax to be taken for antiquities
    /// @param _gasTaxBPS the amount of tax to be taken for gas
    /// @dev this function can only be called by the owner, max totalTax is 15%, marketing + antiquities + gas tax must be over 1%
    function setFees(
        uint256 _reflectionTaxBPS,
        uint256 _marketingTaxBPS,
        uint256 _antiquitiesTaxBPS,
        uint256 _gasTaxBPS
    ) public onlyRole(FEE_ROLE) {
        _taxFee = _reflectionTaxBPS;
        _marketingFee = _marketingTaxBPS;
        _antiquitiesFee = _antiquitiesTaxBPS;
        _gasFee = _gasTaxBPS;

        _totalTax = _taxFee + _marketingFee + _antiquitiesFee + _gasFee;
        require(_totalTax <= 1500, "total tax cannot exceed 15%");
        require(
            (_marketingFee + _antiquitiesFee + _gasFee) >= 100,
            "ERR: marketing + antiquities + gas tax must be over 1%"
        );

        _updatePairsFee(_marketingFee + _antiquitiesFee + _gasFee);
    }

    //to recieve ETH from uniswapV2Router when swaping
    receive() external payable {}

    /// @notice distributes reflection fee
    /// @param rFee the fee to be distributed
    /// @param tFee the fee to be added to the counter
    function _reflectFee(uint256 rFee, uint256 tFee) private {
        _rTotal = _rTotal - rFee;
        _tFeeTotal = _tFeeTotal + tFee;
    }

    /// @notice calculates the transfer values
    /// @param tAmount the amount of tokens to be transferred
    /// @return rAmount the total amount of reflections to be transferred
    /// @return rTransferAmount the amount of reflections to be transferred after tax
    /// @return rFee the tax fee to be reflected
    /// @return tTransferAmount the amount of tokens to be transferred after tax
    /// @return tFee the amount of tokens to be taxed
    function _getValues(
        uint256 tAmount
    )
        private
        view
        returns (
            uint256 rAmount,
            uint256 rTransferAmount,
            uint256 rFee,
            uint256 tTransferAmount,
            uint256 tFee
        )
    {
        (tFee, tTransferAmount) = _getTValues(tAmount);
        (rAmount, rTransferAmount, rFee) = _getRValues(
            tAmount,
            tFee,
            _getRate()
        );
        return (rAmount, rTransferAmount, rFee, tTransferAmount, tFee);
    }

    /// @notice calculates the tax fee
    /// @param tAmount the amount of tokens to be taxed
    /// @return tFee the amount of tokens to be taxed
    /// @return tTransferAmount the amount of tokens to be transferred after tax
    function _getTValues(
        uint256 tAmount
    ) private view returns (uint256 tFee, uint256 tTransferAmount) {
        tFee = calculateTaxFee(tAmount);
        tTransferAmount = tAmount - tFee;
    }

    /// @notice calculates the reflection coefficient and fee
    /// @param tAmount the amount of tokens to be taxed
    /// @param tFee the amount of tokens to be taxed in total
    /// @param currentRate the current rate of reflections
    /// @return rAmount the total amount of reflections to be transferred
    /// @return rTransferAmount the amount of reflections to be transferred after tax
    /// @return rFee the tax fee to be reflected
    function _getRValues(
        uint256 tAmount,
        uint256 tFee,
        uint256 currentRate
    )
        private
        pure
        returns (uint256 rAmount, uint256 rTransferAmount, uint256 rFee)
    {
        rAmount = tAmount * currentRate;
        rFee = tFee * currentRate;
        rTransferAmount = rAmount - rFee;
    }

    /// @notice calculates the current reflection rate
    /// @return the current reflection rate based on the supply of reflections and tokens
    function _getRate() private view returns (uint256) {
        (uint256 rSupply, uint256 tSupply) = _getCurrentSupply();
        return rSupply / tSupply;
    }

    /// @notice calculates the current supply of reflections and tokens
    /// @return rSupply the current supply of reflections
    /// @return tSupply the current supply of tokens
    /// @dev this function removes all excluded value amounts from the supply
    function _getCurrentSupply() private view returns (uint256, uint256) {
        uint256 rSupply = _rTotal;
        uint256 tSupply = _tTotal;
        if (excludedR > rSupply || excludedT > tSupply)
            return (_rTotal, _tTotal);

        rSupply = rSupply - excludedR;
        tSupply = tSupply - excludedT;

        if (rSupply < _rTotal / _tTotal) return (_rTotal, _tTotal);
        return (rSupply, tSupply);
    }

    /// @notice calculates the tax fee
    /// @param _amount the amount of tokens to be taxed
    /// @return the amount of tokens to be taxed
    function calculateTaxFee(uint256 _amount) private view returns (uint256) {
        return (_amount * _taxFee) / 10 ** 4;
    }

    /// @notice remove all fees
    function removeAllFee() private {
        if (_taxFee == 0) return;
        _previousTaxFee = _taxFee;
        _taxFee = 0;
    }

    /// @notice restore all fees
    function restoreAllFee() private {
        _taxFee = _previousTaxFee;
    }

    /// @notice checks the exclusion status of an account
    function isExcludedFromFee(address account) public view returns (bool) {
        return _isExcludedFromFee[account];
    }

    /// @notice Sets the allowance to a specific value
    /// @param _owner the owner of the allowance
    /// @param spender the spender of the allowance
    /// @param amount the amount of allowance
    function _approve(address _owner, address spender, uint256 amount) private {
        require(_owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[_owner][spender] = amount;
        emit Approval(_owner, spender, amount);
    }

    /// @notice transfers tokens from one account to another
    /// @param from the account to transfer from
    /// @param to the account to transfer to
    /// @param amount the amount of tokens to transfer
    /// @dev this is the first step where all checks occur before transfer is executed
    function _transfer(address from, address to, uint256 amount) private {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        if (from != owner() && to != owner())
            require(
                amount <= _maxTxAmount,
                "Transfer amount exceeds the maxTxAmount."
            );

        if (from == rareSwapPair && to != depWallet) {
            require(balanceOf(to) + amount <= _maxWallet, "check max wallet");
        }

        //indicates if fee should be deducted from transfer
        bool takeFee = true;

        //if any account belongs to _isExcludedFromFee account then remove the fee
        if (_isExcludedFromFee[from] || _isExcludedFromFee[to]) {
            takeFee = false;
        }

        //transfer amount, it will take tax, burn, liquidity fee
        _tokenTransfer(from, to, amount, takeFee);
    }

    /// @notice transfers tokens from one account to another checks for bots and calculates trade amounts and tax fees
    /// @param sender the account to transfer from
    /// @param recipient the account to transfer to
    /// @param amount the amount of tokens to transfer
    /// @param takeFee indicates if fee should be deducted from transfer
    function _tokenTransfer(
        address sender,
        address recipient,
        uint256 amount,
        bool takeFee
    ) private {
        if (!canTrade) {
            require(sender == owner(), "Trade disabled"); // only owner allowed to trade or add liquidity
        }

        if (botWallets[sender] || botWallets[recipient]) {
            require(botsCantrade, "bots arent allowed to trade");
        }

        if (!takeFee) removeAllFee();

        bool fromExcluded = _isExcluded[sender];
        bool toExcluded = _isExcluded[recipient];

        {
            (
                uint256 rAmount,
                uint256 rTransferAmount,
                uint256 rFee,
                uint256 tTransferAmount,
                uint256 tFee
            ) = _getValues(amount);

            _rOwned[sender] -= rAmount;
            _rOwned[recipient] += rTransferAmount;

            if (fromExcluded) {
                _tOwned[sender] -= amount;
                if (toExcluded) {
                    _tOwned[recipient] += tTransferAmount;
                } else {
                    excludedR -= rAmount;
                    excludedT -= tTransferAmount;
                }
            } else {
                if (toExcluded) {
                    _tOwned[recipient] += tTransferAmount;
                    excludedR += rAmount;
                    excludedT += tTransferAmount;
                }
            }
            _reflectFee(rFee, tFee);
            emit Transfer(sender, recipient, tTransferAmount);
        }
        if (!takeFee) restoreAllFee();
    }

    /// @notice transfers tokens from the exchange to the tax receiving wallets
    /// @param amount the amount of tokens to transfer
    /// @param token the token to transfer
    /// @dev token is only on ERC20
    function depositLPFee(uint256 amount, address token) public onlyExchange {
        uint256 allowanceT = IERC20(token).allowance(msg.sender, address(this));

        if (allowanceT >= amount) {
            IERC20(token).transferFrom(msg.sender, address(this), amount); // _marketingFee + _antiquitiesFee antiquitiesWallet + _gasFee gasWallet
            // calculate individual tax amount
            uint256 marketingAmount = (amount * _marketingFee) /
                (_marketingFee + _antiquitiesFee + _gasFee);
            uint256 antiquitiesAmount = (amount * _antiquitiesFee) /
                (_marketingFee + _antiquitiesFee + _gasFee);
            uint256 gasAmount = amount - marketingAmount - antiquitiesAmount;
            // send WETH to respective wallet
            IERC20(token).transfer(marketingWallet, marketingAmount);
            IERC20(token).transfer(antiquitiesWallet, antiquitiesAmount);
            IERC20(token).transfer(gasWallet, gasAmount);
        }
    }

    /// Lossless Compliance
    /// @dev due to the nature of the implementation of lossless protocol, we need to add the following modifiers to the functions that transfer tokens
    /// @dev these will not be described as they are not part of the RAT token contract but rather the lossless protoco.
    // more information about lossless in their documentation https://docs.lossless.io/protocol/technical-reference/hack-mitigation-protocol
    modifier lssTransfer(address recipient, uint256 amount) {
        if (isLosslessOn) {
            lossless.beforeTransfer(_msgSender(), recipient, amount);
        }
        _;
    }

    modifier lssTransferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) {
        if (isLosslessOn) {
            lossless.beforeTransferFrom(
                _msgSender(),
                sender,
                recipient,
                amount
            );
        }
        _;
    }

    modifier onlyRecoveryAdmin() {
        require(
            _msgSender() == recoveryAdmin,
            "LERC20: Must be recovery admin"
        );
        _;
    }

    /**
     * @notice  Function to set the lossless controller
     *
     * @param   _controller Lossless controller address
     */
    function setLosslessController(
        address _controller
    ) public onlyRole(LOSSLESS_ROLE) {
        require(
            _controller != address(0),
            "BridgeMintableToken: Controller cannot be zero address."
        );
        require(
            _controller != address(lossless),
            "BridgeMintableToken: Cannot set same address."
        );

        lossless = ILssController(_controller);
        if (!isLosslessOn) isLosslessOn = true;
    }

    /**
     * @notice  Function to set the lossless admin that interacts with controller
     *
     * @param   newAdmin address of the new admin
     */
    function setLosslessAdmin(
        address newAdmin
    ) external onlyRole(LOSSLESS_ROLE) {
        require(newAdmin != admin, "LERC20: Cannot set same address");
        admin = newAdmin;
        emit NewAdmin(newAdmin);
    }

    /**
     * @notice  Function to propose a new recovery admin
     *
     * @param   candidate new admin proposed address
     * @param   keyHash Key to accept
     */
    function transferRecoveryAdminOwnership(
        address candidate,
        bytes32 keyHash
    ) external onlyRole(LOSSLESS_ROLE) {
        recoveryAdminCandidate = candidate;
        recoveryAdminKeyHash = keyHash;
        emit NewRecoveryAdminProposal(candidate);
    }

    /**
     * @notice  Function to accept the admin proposal
     * @param   key Key to accept
     */
    function acceptRecoveryAdminOwnership(bytes memory key) external {
        require(
            _msgSender() == recoveryAdminCandidate,
            "LERC20: Must be candidate"
        );
        require(keccak256(key) == recoveryAdminKeyHash, "LERC20: Invalid key");
        recoveryAdmin = recoveryAdminCandidate;
        recoveryAdminCandidate = address(0);
        emit NewRecoveryAdmin(recoveryAdmin);
    }

    /**
     * @notice  Function to retrieve the funds of a blacklisted address.
     *
     * @param   from Array of addresses corresponding to a report and a second report
     */
    function transferOutBlacklistedFunds(address[] calldata from) external {
        require(
            _msgSender() == address(lossless),
            "LERC20: Only lossless contract"
        );

        uint256 fromLength = from.length;

        for (uint256 i = 0; i < fromLength; i++) {
            address fromAddress = from[i];
            uint256 fromBalance = balanceOf(fromAddress);
            // Use internal transfer function to avoid lossless checks and remove fees on this transfer
            _tokenTransfer(fromAddress, address(lossless), fromBalance, false);
        }
    }

    /**
     * @notice  Function to propose turning off everything related to lossless
     */
    function proposeLosslessTurnOff() external onlyRecoveryAdmin {
        require(
            losslessTurnOffTimestamp == 0,
            "LERC20: TurnOff already proposed"
        );
        require(isLosslessOn, "LERC20: Lossless already off");
        losslessTurnOffTimestamp = block.timestamp + timelockPeriod;
        emit LosslessTurnOffProposal(losslessTurnOffTimestamp);
    }

    /**
     * @notice  Function to execute lossless turn off after a period of time
     */
    function executeLosslessTurnOff() external onlyRecoveryAdmin {
        require(losslessTurnOffTimestamp != 0, "LERC20: TurnOff not proposed");
        require(
            losslessTurnOffTimestamp <= block.timestamp,
            "LERC20: Time lock in progress"
        );
        isLosslessOn = false;
        losslessTurnOffTimestamp = 0;
        emit LosslessOff();
    }

    /**
     * @notice  Function to turn on everything related to lossless
     */
    function executeLosslessTurnOn() external onlyRecoveryAdmin {
        require(!isLosslessOn, "LERC20: Lossless already on");
        losslessTurnOffTimestamp = 0;
        isLosslessOn = true;
        emit LosslessOn();
    }

    function getAdmin() external view returns (address) {
        return admin;
    }
}

interface ILssController {
    function beforeTransfer(
        address _msgSender,
        address _recipient,
        uint256 _amount
    ) external;

    function beforeTransferFrom(
        address _msgSender,
        address _sender,
        address _recipient,
        uint256 _amount
    ) external;

    function beforeMint(address _to, uint256 _amount) external;

    function beforeBurn(address _account, uint256 _amount) external;
}
//Blade/Semi final review and doc.
