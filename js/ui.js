/**
 * Blackjack Practice - UI Module (Horizontal Layout)
 */

class BlackjackUI {
    constructor(game) {
        this.game = game;
        this.elements = {};
        this.soundEnabled = true;
        this.hintsEnabled = false;
        this.animationDelay = 180;
        this.lastBet = 0;
        this.reshuffleCooldown = false;

        // Extra stats
        this.winStreak = 0;
        this.biggestWin = 0;

        // Load saved UI preferences
        this.loadUIPreferences();

        this.game.onStateChange = this.handleStateChange.bind(this);
        this.game.onCardDealt = this.handleCardDealt.bind(this);
        this.game.onHandResult = this.handleResult.bind(this);
        this.game.onBalanceChange = this.updateBalance.bind(this);

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadSettingsUI();
        this.updateBalance(this.game.balance);
        this.updateStats();
        this.updateShoeInfo();
        this.updateActionButtons();
    }

    cacheElements() {
        this.elements = {
            dealerCards: document.getElementById('dealer-cards'),
            dealerValue: document.getElementById('dealer-value'),
            playerCards: document.getElementById('player-cards'),
            playerValue: document.getElementById('player-value'),

            currentBet: document.getElementById('current-bet-value'),

            btnHalf: document.getElementById('btn-half'),
            btnDoubleBet: document.getElementById('btn-double-bet'),
            btnMax: document.getElementById('btn-max'),
            btnRebet: document.getElementById('btn-rebet'),
            btnClearBet: document.getElementById('btn-clear-bet'),

            balance: document.getElementById('balance'),
            statsHands: document.getElementById('stats-hands'),
            statsWinrate: document.getElementById('stats-winrate'),
            statsProfit: document.getElementById('stats-profit'),
            statsBlackjacks: document.getElementById('stats-blackjacks'),
            statsStreak: document.getElementById('stats-streak'),
            statsBiggest: document.getElementById('stats-biggest'),

            cardsRemaining: document.getElementById('cards-remaining'),
            cardsTotal: document.getElementById('cards-total'),
            deckCount: document.getElementById('deck-count'),

            btnDeal: document.getElementById('btn-deal'),
            btnHit: document.getElementById('btn-hit'),
            btnStand: document.getElementById('btn-stand'),
            btnDouble: document.getElementById('btn-double'),
            btnSplit: document.getElementById('btn-split'),
            btnSurrender: document.getElementById('btn-surrender'),
            btnReshuffle: document.getElementById('btn-reshuffle'),

            settingsModal: document.getElementById('settings-modal'),
            resultOverlay: document.getElementById('result-overlay'),
            resultText: document.getElementById('result-text'),
            resultAmount: document.getElementById('result-amount'),
            resultIcon: document.getElementById('result-icon'),

            hintContainer: document.getElementById('hint-container'),
            hintText: document.getElementById('hint-text'),

            btnSettings: document.getElementById('btn-settings'),
            btnCloseSettings: document.getElementById('btn-close-settings'),
            settingDeckCount: document.getElementById('setting-deck-count'),
            settingReshuffleAt: document.getElementById('setting-reshuffle-at'),
            settingDealerH17: document.getElementById('setting-dealer-h17'),
            toggleHints: document.getElementById('toggle-hints'),
            toggleSound: document.getElementById('toggle-sound'),

            btnAddChips: document.getElementById('btn-add-chips'),
            btnResetStats: document.getElementById('btn-reset-stats'),

            // Add Money Modal
            addMoneyModal: document.getElementById('add-money-modal'),
            btnCloseAddMoney: document.getElementById('btn-close-add-money'),
            customMoneyAmount: document.getElementById('custom-money-amount'),
            btnConfirmAddMoney: document.getElementById('btn-confirm-add-money'),

            betChips: document.getElementById('bet-chips'),
            betAmountDisplay: document.getElementById('bet-amount-display'),

            // Deal button and action dock containers
            dealButtonContainer: document.getElementById('deal-button-container'),
            actionDock: document.getElementById('action-dock')
        };
    }

    bindEvents() {
        // Chips - left click to add, right click to remove
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.addToBet(parseInt(chip.dataset.value));
                this.playSound('chip');
            });
            chip.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.removeFromBet(parseInt(chip.dataset.value));
                this.playSound('chip');
            });
        });

        // Quick bet
        this.elements.btnHalf?.addEventListener('click', () => this.halfBet());
        this.elements.btnDoubleBet?.addEventListener('click', () => this.doubleBet());
        this.elements.btnMax?.addEventListener('click', () => this.maxBet());
        this.elements.btnRebet?.addEventListener('click', () => this.rebet());
        this.elements.btnClearBet?.addEventListener('click', () => this.clearBet());

        // Actions
        this.elements.btnDeal?.addEventListener('click', () => this.handleDeal());
        this.elements.btnHit?.addEventListener('click', () => this.handleHit());
        this.elements.btnStand?.addEventListener('click', () => this.handleStand());
        this.elements.btnDouble?.addEventListener('click', () => this.handleDouble());
        this.elements.btnSplit?.addEventListener('click', () => this.handleSplit());
        this.elements.btnSurrender?.addEventListener('click', () => this.handleSurrender());

        this.elements.btnReshuffle?.addEventListener('click', () => this.handleReshuffle());

        // Settings
        this.elements.btnSettings?.addEventListener('click', () => this.openSettings());
        this.elements.btnCloseSettings?.addEventListener('click', () => this.closeSettings());
        this.elements.settingsModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) this.closeSettings();
        });

        this.elements.settingDeckCount?.addEventListener('change', (e) => {
            this.game.updateSettings({ deckCount: parseInt(e.target.value) });
            this.updateShoeInfo();
        });

        this.elements.settingReshuffleAt?.addEventListener('change', (e) => {
            this.game.deck.setPenetration(parseFloat(e.target.value));
        });

        this.elements.settingDealerH17?.addEventListener('click', () => {
            const isActive = this.elements.settingDealerH17.classList.toggle('active');
            this.game.updateSettings({ dealerHitsSoft17: isActive });
        });

        this.elements.toggleHints?.addEventListener('click', () => {
            this.hintsEnabled = !this.hintsEnabled;
            this.elements.toggleHints.classList.toggle('active', this.hintsEnabled);
            this.updateHint();
            this.saveUIPreferences();
        });

        this.elements.toggleSound?.addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            this.elements.toggleSound.classList.toggle('active', this.soundEnabled);
            this.saveUIPreferences();
        });

        // Add Money Modal
        this.elements.btnAddChips?.addEventListener('click', () => this.openAddMoneyModal());
        this.elements.btnCloseAddMoney?.addEventListener('click', () => this.closeAddMoneyModal());
        this.elements.addMoneyModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.addMoneyModal) this.closeAddMoneyModal();
        });
        this.elements.btnConfirmAddMoney?.addEventListener('click', () => this.confirmAddMoney());

        // Quick amount buttons in Add Money modal
        document.querySelectorAll('.quick-amount-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = parseInt(btn.dataset.amount);
                if (this.elements.customMoneyAmount) {
                    this.elements.customMoneyAmount.value = amount;
                }
            });
        });

        // Allow Enter key to confirm in money input
        this.elements.customMoneyAmount?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.confirmAddMoney();
            }
        });

        this.elements.btnResetStats?.addEventListener('click', () => {
            this.game.resetStats();
            this.winStreak = 0;
            this.biggestWin = 0;
            this.saveUIPreferences();
            this.updateStats();
            this.showToast('Statistics reset');
            this.closeSettings();
        });

        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        this.elements.resultOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.resultOverlay && this.game.state === GameState.GAME_OVER) {
                this.hideResult();
                this.handleNewRound();
            }
        });
    }

    // Quick Bets
    halfBet() {
        if (this.game.state !== GameState.BETTING) return;
        const half = Math.floor(this.getCurrentBet() / 2);
        if (half >= this.game.settings.minBet) this.setBet(half);
    }

    doubleBet() {
        if (this.game.state !== GameState.BETTING) return;
        const doubled = Math.min(this.getCurrentBet() * 2, this.game.balance, this.game.settings.maxBet);
        this.setBet(doubled);
    }

    maxBet() {
        if (this.game.state !== GameState.BETTING) return;
        this.setBet(Math.min(this.game.balance, this.game.settings.maxBet));
    }

    rebet() {
        if (this.game.state !== GameState.BETTING) return;
        if (this.lastBet > 0 && this.lastBet <= this.game.balance) {
            this.setBet(this.lastBet);
            this.playSound('chip');
        }
    }

    getCurrentBet() {
        return parseInt((this.elements.currentBet?.textContent || '0').replace(/,/g, ''));
    }

    setBet(amount) {
        if (this.elements.currentBet) {
            this.elements.currentBet.textContent = amount.toLocaleString();
        }
        this.updateChipStack(amount);
        this.updateActionButtons();
    }

    updateChipStack(amount) {
        if (!this.elements.betChips || !this.elements.betAmountDisplay) return;

        this.elements.betAmountDisplay.textContent = amount > 0 ? `$${amount.toLocaleString()}` : '$0';
        this.elements.betChips.innerHTML = '';

        if (amount <= 0) return;

        // Break down into chip denominations
        const chipValues = [1000, 500, 100, 25, 5, 1];
        const chipClasses = ['chip-1000', 'chip-500', 'chip-100', 'chip-25', 'chip-5', 'chip-1'];
        let remaining = amount;
        const stacks = {};

        chipValues.forEach((val, i) => {
            const count = Math.floor(remaining / val);
            if (count > 0) {
                stacks[chipClasses[i]] = Math.min(count, 5); // Max 5 per stack for visuals
                remaining -= count * val;
            }
        });

        // Render chip stacks
        Object.entries(stacks).forEach(([cls, count]) => {
            const stack = document.createElement('div');
            stack.className = 'bet-chip-stack';
            for (let i = 0; i < count; i++) {
                const chip = document.createElement('div');
                chip.className = `bet-chip-mini ${cls}`;
                stack.appendChild(chip);
            }
            this.elements.betChips.appendChild(stack);
        });
    }

    addToBet(amount) {
        if (this.game.state !== GameState.BETTING) return;
        this.setBet(Math.min(this.getCurrentBet() + amount, this.game.balance, this.game.settings.maxBet));
    }

    removeFromBet(amount) {
        if (this.game.state !== GameState.BETTING) return;
        const newBet = Math.max(this.getCurrentBet() - amount, 0);
        this.setBet(newBet);
    }

    clearBet() {
        if (this.game.state !== GameState.BETTING) return;
        this.setBet(0);
    }

    handleReshuffle() {
        if (this.reshuffleCooldown || this.game.state !== GameState.BETTING) {
            if (this.game.state !== GameState.BETTING) this.showToast('Cannot reshuffle during a hand', 'error');
            return;
        }

        this.game.reshuffle();
        this.updateShoeInfo();
        this.showToast('Deck reshuffled');

        this.reshuffleCooldown = true;
        this.elements.btnReshuffle.disabled = true;
        this.elements.btnReshuffle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> 30s';

        let countdown = 30;
        const interval = setInterval(() => {
            countdown--;
            this.elements.btnReshuffle.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${countdown}s`;
            if (countdown <= 0) {
                clearInterval(interval);
                this.reshuffleCooldown = false;
                this.elements.btnReshuffle.disabled = false;
                this.elements.btnReshuffle.innerHTML = '<i class="fa-solid fa-rotate"></i> Reshuffle';
            }
        }, 1000);
    }

    // Game Actions
    async handleDeal() {
        const bet = this.getCurrentBet();
        if (bet < this.game.settings.minBet) {
            this.showToast(`Minimum bet is $${this.game.settings.minBet}`, 'error');
            return;
        }

        this.lastBet = bet;
        if (!this.game.placeBet(bet)) return;

        this.clearCards();
        this.updateShoeInfo();
        await this.game.deal();
    }

    async handleHit() {
        if (!this.game.canHit()) return;
        this.playSound('card');
        await this.game.hit();
        this.updateShoeInfo();
    }

    async handleStand() {
        if (!this.game.canStand()) return;
        await this.game.stand();
    }

    async handleDouble() {
        if (!this.game.canDouble()) return;
        this.playSound('chip');
        await this.game.double();
        this.updateShoeInfo();
    }

    async handleSplit() {
        if (!this.game.canSplit()) return;
        this.playSound('chip');
        await this.game.split();
        this.renderPlayerHands();
    }

    async handleSurrender() {
        if (!this.game.canSurrender()) return;
        await this.game.surrender();
    }

    handleNewRound() {
        this.game.newRound();
        this.clearCards();
        this.hideResult();
        this.setBet(0);
        this.updateShoeInfo();

        if (this.elements.dealerValue) this.elements.dealerValue.textContent = '-';
        if (this.elements.playerValue) this.elements.playerValue.textContent = '-';
    }

    // Rendering
    clearCards() {
        if (this.elements.dealerCards) this.elements.dealerCards.innerHTML = '';
        if (this.elements.playerCards) this.elements.playerCards.innerHTML = '';
    }

    createCardElement(card, faceUp = true) {
        const cardEl = document.createElement('div');
        cardEl.className = `card ${card.color} dealing`;
        if (!faceUp) cardEl.classList.add('flipped');

        cardEl.innerHTML = `
            <div class="card-face card-front">
                <div class="card-corner top-left">
                    <span class="card-rank">${card.rank}</span>
                    <span class="card-suit">${card.suit}</span>
                </div>
                <span class="card-center">${card.suit}</span>
                <div class="card-corner bottom-right">
                    <span class="card-rank">${card.rank}</span>
                    <span class="card-suit">${card.suit}</span>
                </div>
            </div>
            <div class="card-face card-back"></div>
        `;

        return cardEl;
    }

    async handleCardDealt(card, hand, isReveal = false) {
        return new Promise(resolve => {
            const isDealer = hand === this.game.dealerHand;
            const container = isDealer ? this.elements.dealerCards : this.elements.playerCards;

            if (!container) { resolve(); return; }

            if (isReveal) {
                const holeCard = container.querySelector('.flipped');
                if (holeCard) {
                    holeCard.classList.remove('flipped');
                    this.playSound('card');
                }
            } else {
                container.appendChild(this.createCardElement(card, card.faceUp !== false));
                this.playSound('card');
            }

            this.updateHandValue(hand, isDealer);
            setTimeout(resolve, this.animationDelay);
        });
    }

    updateHandValue(hand, isDealer) {
        const valueEl = isDealer ? this.elements.dealerValue : this.elements.playerValue;
        if (!valueEl) return;

        if (isDealer && this.game.state === GameState.PLAYER_TURN) {
            valueEl.textContent = hand.cards[0]?.value || '-';
        } else {
            valueEl.textContent = hand.getValueDisplay() || '-';
            valueEl.classList.remove('blackjack', 'bust');
            if (hand.isBlackjack()) valueEl.classList.add('blackjack');
            if (hand.isBusted) valueEl.classList.add('bust');
        }
    }

    renderPlayerHands() {
        if (this.game.playerHands.length > 1) {
            this.elements.playerCards.innerHTML = '';
            this.game.playerHands.forEach((hand, i) => {
                const container = document.createElement('div');
                container.className = 'split-hand' + (i === this.game.currentHandIndex ? ' active' : '');
                hand.cards.forEach(card => container.appendChild(this.createCardElement(card, true)));
                this.elements.playerCards.appendChild(container);
            });
        }
    }

    handleStateChange(state) {
        this.updateActionButtons();
        this.updateHint();
        if (state === GameState.DEALER_TURN) {
            this.updateHandValue(this.game.dealerHand, true);
        }
    }

    updateActionButtons() {
        const state = this.game.state;
        const bet = this.getCurrentBet();

        const isBetting = state === GameState.BETTING;
        const isPlaying = state === GameState.PLAYER_TURN;
        const isGameOver = state === GameState.GAME_OVER;
        const isDealerTurn = state === GameState.DEALER_TURN;

        // Toggle visibility: Deal button during betting, action dock during gameplay
        if (this.elements.dealButtonContainer) {
            this.elements.dealButtonContainer.classList.toggle('hidden', !isBetting);
        }
        if (this.elements.actionDock) {
            this.elements.actionDock.classList.toggle('visible', isPlaying || isDealerTurn);
        }

        // Deal button - enabled only in betting phase with valid bet
        if (this.elements.btnDeal) {
            this.elements.btnDeal.disabled = !isBetting || bet < this.game.settings.minBet;
        }

        // Disable chips/quick bets when not betting
        document.querySelectorAll('.chip, .quick-btn').forEach(el => {
            el.style.opacity = isBetting ? '1' : '0.4';
            el.style.pointerEvents = isBetting ? 'auto' : 'none';
        });

        // Hit button - enabled only during player turn and can hit
        if (this.elements.btnHit) {
            this.elements.btnHit.disabled = !isPlaying || !this.game.canHit();
        }

        // Stand button - enabled only during player turn
        if (this.elements.btnStand) {
            this.elements.btnStand.disabled = !isPlaying || !this.game.canStand();
        }

        // Double button - enabled only if can double
        if (this.elements.btnDouble) {
            this.elements.btnDouble.disabled = !isPlaying || !this.game.canDouble();
        }

        // Split button - enabled only if can split
        if (this.elements.btnSplit) {
            this.elements.btnSplit.disabled = !isPlaying || !this.game.canSplit();
        }

        // Surrender button - enabled only if can surrender
        if (this.elements.btnSurrender) {
            this.elements.btnSurrender.disabled = !isPlaying || !this.game.canSurrender();
        }
    }

    updateShoeInfo() {
        if (this.elements.cardsRemaining) this.elements.cardsRemaining.textContent = this.game.deck.remaining;
        if (this.elements.cardsTotal) this.elements.cardsTotal.textContent = this.game.deck.total;
        if (this.elements.deckCount) this.elements.deckCount.textContent = this.game.deck.deckCount;
    }

    updateBalance(balance) {
        if (this.elements.balance) this.elements.balance.textContent = balance.toLocaleString();
    }

    updateStats() {
        const stats = this.game.stats;

        if (this.elements.statsHands) this.elements.statsHands.textContent = stats.handsPlayed;

        if (this.elements.statsWinrate) {
            const rate = stats.handsPlayed > 0 ? Math.round((stats.handsWon / stats.handsPlayed) * 100) : 0;
            this.elements.statsWinrate.textContent = `${rate}%`;
        }

        if (this.elements.statsProfit) {
            const profit = stats.netProfit;
            this.elements.statsProfit.textContent = `${profit >= 0 ? '+' : ''}$${Math.abs(profit).toLocaleString()}`;
            this.elements.statsProfit.classList.toggle('positive', profit >= 0);
            this.elements.statsProfit.classList.toggle('negative', profit < 0);
        }

        if (this.elements.statsBlackjacks) this.elements.statsBlackjacks.textContent = stats.blackjacks || 0;
        if (this.elements.statsStreak) this.elements.statsStreak.textContent = this.winStreak;
        if (this.elements.statsBiggest) this.elements.statsBiggest.textContent = `$${this.biggestWin}`;
    }

    handleResult(result, amount) {
        // Track streaks and biggest win
        if (result === ResultType.WIN || result === ResultType.BLACKJACK) {
            this.winStreak++;
            if (amount > this.biggestWin) this.biggestWin = amount;
        } else if (result === ResultType.LOSE) {
            this.winStreak = 0;
        }

        this.saveUIPreferences();
        this.updateStats();

        const resultData = {
            [ResultType.BLACKJACK]: { text: 'BLACKJACK!', className: 'blackjack', cardClass: 'blackjack-card', icon: '<i class="fa-solid fa-crown"></i>' },
            [ResultType.WIN]: { text: 'YOU WIN!', className: 'win', cardClass: 'win-card', icon: '<i class="fa-solid fa-trophy"></i>' },
            [ResultType.LOSE]: { text: 'DEALER WINS', className: 'lose', cardClass: 'lose-card', icon: '<i class="fa-solid fa-face-sad-tear"></i>' },
            [ResultType.PUSH]: { text: 'PUSH', className: 'push', cardClass: 'push-card', icon: '<i class="fa-solid fa-handshake"></i>' },
            [ResultType.SURRENDER]: { text: 'SURRENDER', className: 'push', cardClass: 'push-card', icon: '<i class="fa-solid fa-flag"></i>' }
        };

        const data = resultData[result] || { text: '', className: '', cardClass: '', icon: '' };

        // Get the result card element and update its class
        const resultCard = this.elements.resultOverlay?.querySelector('.result-card');
        if (resultCard) {
            resultCard.className = `result-card ${data.cardClass}`;
        }

        // Update icon
        if (this.elements.resultIcon) {
            this.elements.resultIcon.innerHTML = data.icon;
        }

        if (this.elements.resultText) {
            this.elements.resultText.textContent = data.text;
            this.elements.resultText.className = `result-text ${data.className}`;
        }

        if (this.elements.resultAmount) {
            this.elements.resultAmount.textContent = `${amount >= 0 ? '+' : ''}$${Math.abs(amount).toLocaleString()}`;
            // Add color class based on amount
            this.elements.resultAmount.className = 'result-amount';
            if (amount > 0) this.elements.resultAmount.classList.add('positive');
            else if (amount < 0) this.elements.resultAmount.classList.add('negative');
            else this.elements.resultAmount.classList.add('neutral');
        }

        if (result === ResultType.WIN || result === ResultType.BLACKJACK) this.playSound('win');
        else if (result === ResultType.LOSE) this.playSound('lose');

        this.showResult();
    }

    showResult() {
        // Clear any existing timeout
        if (this.resultTimeout) clearTimeout(this.resultTimeout);

        const overlay = this.elements.resultOverlay;
        if (!overlay) return;

        overlay.classList.remove('fade-out');
        overlay.classList.add('visible');

        // Auto-dismiss after 1.5 seconds
        this.resultTimeout = setTimeout(() => {
            overlay.classList.add('fade-out');
            // After fade animation completes, hide and start new round
            setTimeout(() => {
                this.hideResult();
                if (this.game.state === GameState.GAME_OVER) {
                    this.handleNewRound();
                }
            }, 400);
        }, 1500);
    }

    hideResult() {
        if (this.resultTimeout) {
            clearTimeout(this.resultTimeout);
            this.resultTimeout = null;
        }
        const overlay = this.elements.resultOverlay;
        if (overlay) {
            overlay.classList.remove('visible', 'fade-out');
        }
    }

    updateHint() {
        if (!this.hintsEnabled || this.game.state !== GameState.PLAYER_TURN) {
            if (this.elements.hintContainer) this.elements.hintContainer.style.display = 'none';
            return;
        }

        const hint = this.game.getStrategyHint();
        if (hint && this.elements.hintText) {
            this.elements.hintText.textContent = hint;
            if (this.elements.hintContainer) this.elements.hintContainer.style.display = '';
        }
    }

    openSettings() { this.elements.settingsModal?.classList.add('visible'); }
    closeSettings() { this.elements.settingsModal?.classList.remove('visible'); }

    // Add Money Modal
    openAddMoneyModal() {
        this.elements.addMoneyModal?.classList.add('visible');
        // Focus the input field
        setTimeout(() => {
            this.elements.customMoneyAmount?.focus();
            this.elements.customMoneyAmount?.select();
        }, 100);
    }

    closeAddMoneyModal() {
        this.elements.addMoneyModal?.classList.remove('visible');
    }

    confirmAddMoney() {
        const input = this.elements.customMoneyAmount;
        if (!input) return;

        const amount = parseInt(input.value);
        if (isNaN(amount) || amount <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }

        if (amount > 1000000) {
            this.showToast('Maximum amount is $1,000,000', 'error');
            return;
        }

        this.game.addChips(amount);
        this.showToast(`Added $${amount.toLocaleString()}`);
        this.closeAddMoneyModal();

        // Reset to default value
        input.value = '10000';
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 150);
        }, 2500);
    }

    playSound(type) {
        if (!this.soundEnabled) return;

        if (!this.audioContext) {
            try { this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
            catch { return; }
        }

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        const sounds = {
            card: [800, 0.025, 0.03],
            chip: [1200, 0.025, 0.02],
            win: [523.25, 0.05, 0.25],
            lose: [300, 0.03, 0.1]
        };

        const [freq, vol, dur] = sounds[type] || [440, 0.02, 0.05];
        osc.frequency.value = freq;
        gain.gain.value = vol;
        if (type === 'lose') osc.type = 'sawtooth';
        osc.start();

        if (type === 'win') {
            setTimeout(() => osc.frequency.value = 659.25, 70);
            setTimeout(() => osc.frequency.value = 783.99, 140);
        }

        osc.stop(this.audioContext.currentTime + dur);
    }

    handleKeyboard(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        // Number keys for chip amounts (1-6)
        const chipKeyMap = {
            '1': 1,
            '2': 5,
            '3': 25,
            '4': 100,
            '5': 500,
            '6': 1000
        };

        // Check for chip keybinds first
        if (chipKeyMap[e.key] && this.game.state === GameState.BETTING) {
            this.addToBet(chipKeyMap[e.key]);
            this.playSound('chip');
            return;
        }

        const keyMap = {
            'h': () => this.handleHit(),
            's': () => this.handleStand(),
            'd': () => this.handleDouble(),
            'p': () => this.handleSplit(),
            'r': () => !e.ctrlKey && this.handleSurrender(),
            'enter': () => {
                if (this.game.state === GameState.BETTING) this.handleDeal();
                else if (this.game.state === GameState.GAME_OVER) { this.hideResult(); this.handleNewRound(); }
            },
            ' ': () => {
                if (this.game.state === GameState.BETTING) this.handleDeal();
                else if (this.game.state === GameState.GAME_OVER) { this.hideResult(); this.handleNewRound(); }
            },
            'c': () => {
                if (this.game.state === GameState.BETTING) this.clearBet();
            }
        };

        const action = keyMap[e.key.toLowerCase()];
        if (action) {
            action();
            if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
        }
    }

    // Persistence for UI preferences
    saveUIPreferences() {
        try {
            const prefs = {
                soundEnabled: this.soundEnabled,
                hintsEnabled: this.hintsEnabled,
                lastBet: this.lastBet,
                winStreak: this.winStreak,
                biggestWin: this.biggestWin
            };
            localStorage.setItem('blackjack_ui_prefs', JSON.stringify(prefs));
        } catch (e) {
            console.warn('Could not save UI preferences:', e);
        }
    }

    loadUIPreferences() {
        try {
            const saved = localStorage.getItem('blackjack_ui_prefs');
            if (saved) {
                const prefs = JSON.parse(saved);
                this.soundEnabled = prefs.soundEnabled ?? true;
                this.hintsEnabled = prefs.hintsEnabled ?? false;
                this.lastBet = prefs.lastBet ?? 0;
                this.winStreak = prefs.winStreak ?? 0;
                this.biggestWin = prefs.biggestWin ?? 0;
            }
        } catch (e) {
            console.warn('Could not load UI preferences:', e);
        }
    }

    loadSettingsUI() {
        // Sync UI toggles with loaded settings
        if (this.elements.toggleSound) {
            this.elements.toggleSound.classList.toggle('active', this.soundEnabled);
        }
        if (this.elements.toggleHints) {
            this.elements.toggleHints.classList.toggle('active', this.hintsEnabled);
        }
        if (this.elements.settingDealerH17) {
            this.elements.settingDealerH17.classList.toggle('active', this.game.settings.dealerHitsSoft17);
        }
        if (this.elements.settingDeckCount) {
            this.elements.settingDeckCount.value = this.game.settings.deckCount;
        }
        if (this.elements.settingReshuffleAt && this.game.deck.penetration) {
            this.elements.settingReshuffleAt.value = this.game.deck.penetration;
        }
    }
}

window.BlackjackUI = BlackjackUI;

