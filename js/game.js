/**
 * Blackjack Practice - Game Engine
 * Core game logic and state management
 */

// Game states
const GameState = {
    BETTING: 'betting',
    DEALING: 'dealing',
    PLAYER_TURN: 'player_turn',
    DEALER_TURN: 'dealer_turn',
    PAYOUT: 'payout',
    GAME_OVER: 'game_over'
};

// Result types
const ResultType = {
    WIN: 'win',
    LOSE: 'lose',
    PUSH: 'push',
    BLACKJACK: 'blackjack',
    SURRENDER: 'surrender'
};

/**
 * Main game class
 */
class BlackjackGame {
    constructor() {
        // Game components
        this.deck = new Deck(6);
        this.playerHands = [new Hand()];
        this.dealerHand = new Hand();
        this.currentHandIndex = 0;

        // Game state
        this.state = GameState.BETTING;
        this.balance = 10000;
        this.currentBet = 0;

        // Settings
        this.settings = {
            deckCount: 6,
            dealerHitsSoft17: true,
            blackjackPays: 1.5,  // 3:2
            doubleAfterSplit: true,
            resplitAces: false,
            surrenderAllowed: true,
            insuranceAllowed: true,
            minBet: 10,
            maxBet: 999000000000
        };

        // Statistics
        this.stats = {
            handsPlayed: 0,
            handsWon: 0,
            handsLost: 0,
            handsPushed: 0,
            blackjacks: 0,
            totalWagered: 0,
            netProfit: 0
        };

        // Callbacks for UI updates
        this.onStateChange = null;
        this.onCardDealt = null;
        this.onHandResult = null;
        this.onBalanceChange = null;

        // Initialize - Load saved data first
        this.loadAllData();
        this.deck.shuffle();
    }

    /**
     * Get the current player hand
     */
    get currentHand() {
        return this.playerHands[this.currentHandIndex];
    }

    /**
     * Place a bet and start a new round
     * @param {number} amount - Bet amount
     * @returns {boolean} Success
     */
    placeBet(amount) {
        if (this.state !== GameState.BETTING) {
            console.warn('Cannot place bet during active hand');
            return false;
        }

        if (amount < this.settings.minBet || amount > this.settings.maxBet) {
            console.warn(`Bet must be between ${this.settings.minBet} and ${this.settings.maxBet}`);
            return false;
        }

        if (amount > this.balance) {
            console.warn('Insufficient balance');
            return false;
        }

        this.currentBet = amount;
        this.balance -= amount;
        this.playerHands[0].bet = amount;
        this.stats.totalWagered += amount;

        this.notifyBalanceChange();
        this.saveBalance();
        return true;
    }

    /**
     * Deal initial cards
     */
    async deal() {
        if (this.currentBet === 0) {
            console.warn('Must place bet before dealing');
            return;
        }

        // Check if reshuffle needed
        if (this.deck.needsReshuffle()) {
            this.deck.reshuffle();
            this.notifyReshuffle();
        }

        this.state = GameState.DEALING;
        this.notifyStateChange();

        // Clear previous hands
        this.playerHands = [new Hand()];
        this.playerHands[0].bet = this.currentBet;
        this.dealerHand.clear();
        this.currentHandIndex = 0;

        // Deal cards: player, dealer, player, dealer (face down)
        await this.dealCardToHand(this.currentHand, true);
        await this.dealCardToHand(this.dealerHand, true);
        await this.dealCardToHand(this.currentHand, true);
        await this.dealCardToHand(this.dealerHand, false); // Hole card face down

        // Check for dealer blackjack if showing Ace or 10
        const dealerUpCard = this.dealerHand.cards[0];

        if (dealerUpCard.isAce && this.settings.insuranceAllowed) {
            // Offer insurance
            this.state = GameState.PLAYER_TURN;
            this.notifyStateChange();
            return;
        }

        // Check for player blackjack
        if (this.currentHand.isBlackjack()) {
            await this.handleBlackjack();
            return;
        }

        // Start player turn
        this.state = GameState.PLAYER_TURN;
        this.notifyStateChange();
    }

    /**
     * Deal a card to a hand
     * @param {Hand} hand - Target hand
     * @param {boolean} faceUp - Whether card is face up
     */
    async dealCardToHand(hand, faceUp = true) {
        const card = this.deck.deal();
        card.faceUp = faceUp;
        hand.addCard(card);

        if (this.onCardDealt) {
            await this.onCardDealt(card, hand);
        }
    }

    /**
     * Player hits
     */
    async hit() {
        if (this.state !== GameState.PLAYER_TURN) return;

        await this.dealCardToHand(this.currentHand, true);

        if (this.currentHand.isBusted) {
            await this.handleHandComplete();
        } else if (this.currentHand.getValue() === 21) {
            // Auto-stand on 21 for faster, more rewarding gameplay
            this.currentHand.isStood = true;
            await this.handleHandComplete();
        }

        this.notifyStateChange();
    }

    /**
     * Player stands
     */
    async stand() {
        if (this.state !== GameState.PLAYER_TURN) return;

        this.currentHand.isStood = true;
        await this.handleHandComplete();
    }

    /**
     * Player doubles down
     */
    async double() {
        if (this.state !== GameState.PLAYER_TURN) return;
        if (!this.currentHand.canDouble()) return;

        const additionalBet = this.currentHand.bet;
        if (additionalBet > this.balance) {
            console.warn('Insufficient balance to double');
            return;
        }

        this.balance -= additionalBet;
        this.currentHand.bet *= 2;
        this.currentHand.isDoubled = true;
        this.stats.totalWagered += additionalBet;

        this.notifyBalanceChange();

        // Deal one card and stand
        await this.dealCardToHand(this.currentHand, true);
        this.currentHand.isStood = true;

        await this.handleHandComplete();
    }

    /**
     * Player splits
     */
    async split() {
        if (this.state !== GameState.PLAYER_TURN) return;
        if (!this.currentHand.canSplit()) return;

        const additionalBet = this.currentHand.bet;
        if (additionalBet > this.balance) {
            console.warn('Insufficient balance to split');
            return;
        }

        this.balance -= additionalBet;
        this.stats.totalWagered += additionalBet;

        // Create new hand with second card
        const newHand = new Hand();
        newHand.bet = additionalBet;
        newHand.isSplit = true;
        newHand.addCard(this.currentHand.cards.pop());

        // Mark current hand as split
        this.currentHand.isSplit = true;

        // Add new hand
        this.playerHands.splice(this.currentHandIndex + 1, 0, newHand);

        // Deal a card to each split hand
        await this.dealCardToHand(this.currentHand, true);

        this.notifyBalanceChange();
        this.notifyStateChange();
    }

    /**
     * Player surrenders
     */
    async surrender() {
        if (this.state !== GameState.PLAYER_TURN) return;
        if (this.currentHand.cards.length !== 2) return;
        if (!this.settings.surrenderAllowed) return;

        this.currentHand.isSurrendered = true;

        // Return half the bet
        const returnAmount = this.currentHand.bet / 2;
        this.balance += returnAmount;

        this.notifyBalanceChange();

        await this.handleHandComplete();
    }

    /**
     * Player takes insurance
     * @param {boolean} take - Whether to take insurance
     */
    async insurance(take) {
        if (!take) {
            // Check for dealer blackjack
            if (this.dealerHand.isBlackjack()) {
                await this.handleDealerBlackjack();
                return;
            }
            // Continue normal play
            return;
        }

        const insuranceAmount = this.currentHand.bet / 2;
        if (insuranceAmount > this.balance) {
            console.warn('Insufficient balance for insurance');
            return;
        }

        this.balance -= insuranceAmount;
        this.currentHand.insuranceBet = insuranceAmount;

        this.notifyBalanceChange();

        // Check for dealer blackjack
        if (this.dealerHand.isBlackjack()) {
            // Insurance pays 2:1
            this.balance += insuranceAmount * 3;
            this.notifyBalanceChange();
            await this.handleDealerBlackjack();
        }
    }

    /**
     * Handle player blackjack
     */
    async handleBlackjack() {
        // Reveal dealer hole card
        this.dealerHand.cards[1].faceUp = true;

        if (this.dealerHand.isBlackjack()) {
            // Push
            this.balance += this.currentHand.bet;
            this.stats.handsPushed++;
            this.notifyResult(ResultType.PUSH, 0);
        } else {
            // Player blackjack wins
            const winnings = this.currentHand.bet * (1 + this.settings.blackjackPays);
            this.balance += winnings;
            this.stats.handsWon++;
            this.stats.blackjacks++;
            this.stats.netProfit += winnings - this.currentHand.bet;
            this.notifyResult(ResultType.BLACKJACK, winnings - this.currentHand.bet);
        }

        this.notifyBalanceChange();
        this.endRound();
    }

    /**
     * Handle dealer blackjack
     */
    async handleDealerBlackjack() {
        // Reveal dealer hole card
        this.dealerHand.cards[1].faceUp = true;

        // Player loses (unless they also have blackjack)
        for (const hand of this.playerHands) {
            if (hand.isBlackjack()) {
                this.balance += hand.bet;
                this.stats.handsPushed++;
            } else {
                this.stats.handsLost++;
                this.stats.netProfit -= hand.bet;
            }
        }

        this.notifyBalanceChange();
        this.notifyResult(ResultType.LOSE, 0);
        this.endRound();
    }

    /**
     * Handle completion of a player hand
     */
    async handleHandComplete() {
        // Move to next split hand if any
        if (this.currentHandIndex < this.playerHands.length - 1) {
            this.currentHandIndex++;

            // Deal a card to the new hand if needed (after split)
            if (this.currentHand.cards.length === 1) {
                await this.dealCardToHand(this.currentHand, true);
            }

            this.notifyStateChange();
            return;
        }

        // All player hands complete, dealer turn
        await this.dealerTurn();
    }

    /**
     * Dealer plays their hand
     */
    async dealerTurn() {
        // Check if all player hands busted or surrendered
        const allBustedOrSurrendered = this.playerHands.every(h => h.isBusted || h.isSurrendered);

        if (allBustedOrSurrendered) {
            // No need for dealer to play
            this.dealerHand.cards[1].faceUp = true;
            this.resolveHands();
            return;
        }

        this.state = GameState.DEALER_TURN;
        this.notifyStateChange();

        // Reveal hole card
        this.dealerHand.cards[1].faceUp = true;
        if (this.onCardDealt) {
            await this.onCardDealt(this.dealerHand.cards[1], this.dealerHand, true);
        }

        // Dealer hits until 17 (or soft 17 if setting enabled)
        while (this.shouldDealerHit()) {
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.dealCardToHand(this.dealerHand, true);
        }

        this.resolveHands();
    }

    /**
     * Check if dealer should hit
     * @returns {boolean}
     */
    shouldDealerHit() {
        const value = this.dealerHand.getValue();

        if (value < 17) return true;

        if (value === 17 && this.dealerHand.isSoft() && this.settings.dealerHitsSoft17) {
            return true;
        }

        return false;
    }

    /**
     * Resolve all hands and calculate payouts
     */
    resolveHands() {
        this.state = GameState.PAYOUT;

        const dealerValue = this.dealerHand.getValue();
        const dealerBusted = this.dealerHand.isBusted;

        let totalWinnings = 0;

        for (const hand of this.playerHands) {
            const playerValue = hand.getValue();
            let result;
            let payout = 0;

            if (hand.isSurrendered) {
                result = ResultType.SURRENDER;
                payout = hand.bet / 2;
            } else if (hand.isBusted) {
                result = ResultType.LOSE;
                this.stats.handsLost++;
                this.stats.netProfit -= hand.bet;
            } else if (dealerBusted) {
                result = ResultType.WIN;
                payout = hand.bet * 2;
                this.stats.handsWon++;
                this.stats.netProfit += hand.bet;
            } else if (playerValue > dealerValue) {
                result = ResultType.WIN;
                payout = hand.bet * 2;
                this.stats.handsWon++;
                this.stats.netProfit += hand.bet;
            } else if (playerValue < dealerValue) {
                result = ResultType.LOSE;
                this.stats.handsLost++;
                this.stats.netProfit -= hand.bet;
            } else {
                result = ResultType.PUSH;
                payout = hand.bet;
                this.stats.handsPushed++;
            }

            this.balance += payout;
            totalWinnings += payout - hand.bet;
        }

        this.stats.handsPlayed++;
        this.saveStats();

        this.notifyBalanceChange();

        const overallResult = totalWinnings > 0 ? ResultType.WIN :
            totalWinnings < 0 ? ResultType.LOSE : ResultType.PUSH;
        this.notifyResult(overallResult, totalWinnings);

        this.endRound();
    }

    /**
     * End the current round
     */
    endRound() {
        this.state = GameState.GAME_OVER;
        this.notifyStateChange();
    }

    /**
     * Start a new round
     */
    newRound() {
        this.playerHands = [new Hand()];
        this.dealerHand.clear();
        this.currentHandIndex = 0;
        this.currentBet = 0;
        this.state = GameState.BETTING;
        this.notifyStateChange();
    }

    /**
     * Reshuffle the deck
     */
    reshuffle() {
        this.deck.reshuffle();
        this.notifyReshuffle();
    }

    /**
     * Add chips to balance (for practice)
     * @param {number} amount
     */
    addChips(amount) {
        this.balance += amount;
        this.notifyBalanceChange();
        this.saveBalance();
    }

    /**
     * Check if player can perform action
     */
    canHit() {
        return this.state === GameState.PLAYER_TURN &&
            !this.currentHand.isStood &&
            !this.currentHand.isBusted;
    }

    canStand() {
        return this.state === GameState.PLAYER_TURN &&
            !this.currentHand.isStood &&
            !this.currentHand.isBusted;
    }

    canDouble() {
        return this.state === GameState.PLAYER_TURN &&
            this.currentHand.canDouble() &&
            this.currentHand.bet <= this.balance &&
            !this.currentHand.isStood;
    }

    canSplit() {
        if (this.state !== GameState.PLAYER_TURN) return false;
        if (!this.currentHand.canSplit()) return false;
        if (this.currentHand.bet > this.balance) return false;
        if (this.playerHands.length >= 4) return false; // Max 4 hands
        return true;
    }

    canSurrender() {
        return this.state === GameState.PLAYER_TURN &&
            this.settings.surrenderAllowed &&
            this.currentHand.cards.length === 2 &&
            !this.currentHand.isSplit;
    }

    /**
     * Update game settings
     * @param {Object} newSettings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };

        if (newSettings.deckCount !== undefined) {
            this.deck.setDeckCount(newSettings.deckCount);
        }

        this.saveSettings();
    }

    /**
     * Get the basic strategy recommendation
     * @returns {string} Recommended action
     */
    getStrategyHint() {
        if (this.state !== GameState.PLAYER_TURN) return null;
        return getBasicStrategyRecommendation(
            this.currentHand,
            this.dealerHand.cards[0],
            this.canDouble(),
            this.canSplit(),
            this.canSurrender()
        );
    }

    // Notification helpers
    notifyStateChange() {
        if (this.onStateChange) this.onStateChange(this.state);
    }

    notifyBalanceChange() {
        if (this.onBalanceChange) this.onBalanceChange(this.balance);
    }

    notifyResult(result, amount) {
        if (this.onHandResult) this.onHandResult(result, amount);
    }

    notifyReshuffle() {
        console.log('🔄 Deck reshuffled');
    }

    // ===========================================
    // Data Persistence with 1-Week Expiration
    // ===========================================

    // Expiration time: 1 week in milliseconds
    static EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

    /**
     * Save data to localStorage with a timestamp
     * @param {string} key - Storage key
     * @param {any} data - Data to store
     */
    saveWithTimestamp(key, data) {
        try {
            const wrapper = {
                timestamp: Date.now(),
                data: data
            };
            localStorage.setItem(key, JSON.stringify(wrapper));
        } catch (e) {
            console.warn(`Could not save ${key}:`, e);
        }
    }

    /**
     * Load data from localStorage with expiration check
     * @param {string} key - Storage key
     * @returns {any|null} - Stored data or null if expired/missing
     */
    loadWithExpiration(key) {
        try {
            const saved = localStorage.getItem(key);
            if (!saved) return null;

            const wrapper = JSON.parse(saved);

            // Check if data has expired (older than 1 week)
            if (!wrapper.timestamp || Date.now() - wrapper.timestamp > BlackjackGame.EXPIRATION_MS) {
                console.log(`${key} has expired, clearing stored data`);
                localStorage.removeItem(key);
                return null;
            }

            return wrapper.data;
        } catch (e) {
            console.warn(`Could not load ${key}:`, e);
            return null;
        }
    }

    /**
     * Refresh the timestamp on stored data (extends expiration)
     * @param {string} key - Storage key
     */
    refreshTimestamp(key) {
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const wrapper = JSON.parse(saved);
                wrapper.timestamp = Date.now();
                localStorage.setItem(key, JSON.stringify(wrapper));
            }
        } catch (e) {
            console.warn(`Could not refresh timestamp for ${key}:`, e);
        }
    }

    // Stats persistence
    saveStats() {
        this.saveWithTimestamp('blackjack_stats', this.stats);
    }

    loadStats() {
        const saved = this.loadWithExpiration('blackjack_stats');
        if (saved) {
            this.stats = { ...this.stats, ...saved };
        }
    }

    resetStats() {
        this.stats = {
            handsPlayed: 0,
            handsWon: 0,
            handsLost: 0,
            handsPushed: 0,
            blackjacks: 0,
            totalWagered: 0,
            netProfit: 0
        };
        this.saveStats();
    }

    // Comprehensive data persistence
    saveAllData() {
        this.saveBalance();
        this.saveSettings();
        this.saveStats();
    }

    loadAllData() {
        this.loadBalance();
        this.loadSettings();
        this.loadStats();
        // Refresh all timestamps on load to extend expiration
        this.refreshTimestamp('blackjack_balance');
        this.refreshTimestamp('blackjack_settings');
        this.refreshTimestamp('blackjack_stats');
    }

    saveBalance() {
        this.saveWithTimestamp('blackjack_balance', this.balance);
    }

    loadBalance() {
        const saved = this.loadWithExpiration('blackjack_balance');
        if (saved !== null) {
            this.balance = saved;
        }
    }

    saveSettings() {
        this.saveWithTimestamp('blackjack_settings', this.settings);
    }

    loadSettings() {
        const saved = this.loadWithExpiration('blackjack_settings');
        if (saved) {
            this.settings = { ...this.settings, ...saved };
            // Apply deck count
            if (saved.deckCount) {
                this.deck.setDeckCount(saved.deckCount);
            }
        }
    }
}

/**
 * Basic strategy lookup
 */
function getBasicStrategyRecommendation(playerHand, dealerUpCard, canDouble, canSplit, canSurrender) {
    const playerValue = playerHand.getValue();
    const dealerValue = dealerUpCard.value === 11 ? 11 : dealerUpCard.value; // Ace as 11
    const isSoft = playerHand.isSoft();
    const isPair = playerHand.canSplit();

    // Pair splitting
    if (isPair && canSplit) {
        const pairRank = playerHand.cards[0].rank;
        const pairStrategy = {
            'A': 'SPLIT',
            '8': 'SPLIT',
            '2': dealerValue <= 7 ? 'SPLIT' : 'HIT',
            '3': dealerValue <= 7 ? 'SPLIT' : 'HIT',
            '4': (dealerValue === 5 || dealerValue === 6) ? 'SPLIT' : 'HIT',
            '5': dealerValue <= 9 && canDouble ? 'DOUBLE' : 'HIT',
            '6': dealerValue <= 6 ? 'SPLIT' : 'HIT',
            '7': dealerValue <= 7 ? 'SPLIT' : 'HIT',
            '9': [7, 10, 11].includes(dealerValue) ? 'STAND' : 'SPLIT',
            '10': 'STAND',
            'J': 'STAND',
            'Q': 'STAND',
            'K': 'STAND'
        };
        if (pairStrategy[pairRank]) return pairStrategy[pairRank];
    }

    // Soft totals
    if (isSoft) {
        if (playerValue >= 19) return 'STAND';
        if (playerValue === 18) {
            if (dealerValue <= 6 && canDouble) return 'DOUBLE';
            if (dealerValue <= 8) return 'STAND';
            return 'HIT';
        }
        if (playerValue === 17) {
            if (dealerValue >= 3 && dealerValue <= 6 && canDouble) return 'DOUBLE';
            return 'HIT';
        }
        if (playerValue >= 15 && playerValue <= 16) {
            if (dealerValue >= 4 && dealerValue <= 6 && canDouble) return 'DOUBLE';
            return 'HIT';
        }
        if (playerValue >= 13 && playerValue <= 14) {
            if (dealerValue >= 5 && dealerValue <= 6 && canDouble) return 'DOUBLE';
            return 'HIT';
        }
        return 'HIT';
    }

    // Hard totals
    if (playerValue >= 17) return 'STAND';

    if (playerValue >= 13 && playerValue <= 16) {
        if (dealerValue <= 6) return 'STAND';
        if (playerValue === 16 && canSurrender && dealerValue >= 9) return 'SURRENDER';
        if (playerValue === 15 && canSurrender && dealerValue === 10) return 'SURRENDER';
        return 'HIT';
    }

    if (playerValue === 12) {
        if (dealerValue >= 4 && dealerValue <= 6) return 'STAND';
        return 'HIT';
    }

    if (playerValue === 11) {
        return canDouble ? 'DOUBLE' : 'HIT';
    }

    if (playerValue === 10) {
        if (dealerValue <= 9 && canDouble) return 'DOUBLE';
        return 'HIT';
    }

    if (playerValue === 9) {
        if (dealerValue >= 3 && dealerValue <= 6 && canDouble) return 'DOUBLE';
        return 'HIT';
    }

    return 'HIT';
}

// Export
window.BlackjackGame = BlackjackGame;
window.GameState = GameState;
window.ResultType = ResultType;
window.getBasicStrategyRecommendation = getBasicStrategyRecommendation;
