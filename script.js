/**
 * Arena of Valor Draft Helper
 * Main application class for managing hero selection and team analysis
 */
class DraftHelper {
    constructor() {
        this.gameContainer = null;
        this.currentGameIndex = 0;
        this.heroDataList = [];
        this.selectedHero = null;
        this.selectedElement = null;
        this.isLoading = false;
        this.gameStates = new Map(); // Store game states for persistence
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.showLoadingState();
            this.gameContainer = document.querySelector('.game-container');
            
            if (!this.gameContainer) {
                throw new Error('Game container not found');
            }

            // Detect device type and set appropriate settings
            this.detectDeviceType();
            
            await this.loadHeroData();
            this.createInitialGame();
            this.hideLoadingState();
            
            // Add resize listener for responsive adjustments
            this.addResizeListener();
        } catch (error) {
            this.handleError('Failed to initialize application', error);
        }
    }

    /**
     * Detect device type and set appropriate settings
     */
    detectDeviceType() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTablet = /iPad|Android(?=.*\bMobile\b)/i.test(navigator.userAgent);
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        this.deviceInfo = {
            isMobile,
            isTablet,
            isTouchDevice,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight
        };
        
        // Add device class to body for CSS targeting
        document.body.classList.add(isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop');
        if (isTouchDevice) {
            document.body.classList.add('touch-device');
        }
    }

    /**
     * Add resize listener for responsive adjustments
     */
    addResizeListener() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        
        // Update device info
        this.deviceInfo.screenWidth = newWidth;
        this.deviceInfo.screenHeight = newHeight;
        
        // Recalculate hero sizes based on screen size
        this.adjustHeroSizes();
        
        // Update gallery layout if needed
        const gallery = document.querySelector("#hero-gallery");
        if (gallery) {
            this.updateGalleryLayout(gallery);
        }
    }

    /**
     * Adjust hero sizes based on screen size
     */
    adjustHeroSizes() {
        const { screenWidth } = this.deviceInfo;
        let heroSize;
        
        if (screenWidth >= 1200) {
            heroSize = 90;
        } else if (screenWidth >= 992) {
            heroSize = 85;
        } else if (screenWidth >= 768) {
            heroSize = 75;
        } else if (screenWidth >= 576) {
            heroSize = 70;
        } else if (screenWidth >= 480) {
            heroSize = 65;
        } else {
            heroSize = 60;
        }
        
        // Update CSS custom property for hero size
        document.documentElement.style.setProperty('--hero-size', `${heroSize}px`);
    }

    /**
     * Update gallery layout for better mobile experience
     */
    updateGalleryLayout(gallery) {
        const { screenWidth } = this.deviceInfo;
        
        if (screenWidth <= 768) {
            // Use grid layout for mobile
            gallery.style.display = 'grid';
            gallery.style.gridTemplateColumns = 'repeat(auto-fill, minmax(60px, 1fr))';
            gallery.style.gap = '8px';
            gallery.style.padding = '10px';
        } else {
            // Use flex layout for desktop
            gallery.style.display = 'flex';
            gallery.style.flexWrap = 'wrap';
            gallery.style.gap = '10px';
            gallery.style.padding = '0';
        }
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-state';
        loadingDiv.className = 'loading-container';
        loadingDiv.innerHTML = `
            <div class="loading-spinner"></div>
            <p class="loading-text">กำลังโหลดข้อมูลฮีโร่...</p>
        `;
        document.body.appendChild(loadingDiv);
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        const loadingDiv = document.getElementById('loading-state');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    /**
     * Load hero data from CSV file
     */
    async loadHeroData() {
        try {
            const response = await fetch('./ROV.csv');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const csvText = await response.text();
            this.parseHeroData(csvText);
        } catch (error) {
            this.handleError('Failed to load hero data', error);
            throw error;
        }
    }

    /**
     * Parse CSV data into hero objects
     */
    parseHeroData(csvText) {
        const lines = csvText.trim().split('\n');
        const header = lines[0].split(',').map(h => h.trim());
        const noteIndex = header.indexOf("หมายเหตุ");
        const weaknessIndex = header.indexOf("Weakness");

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (!cols[0]) continue;

            const heroObj = {};
            let timeRaw = "";

            header.forEach((key, index) => {
                const col = cols[index] || "";
                const keyLower = key.toLowerCase();
                
                if (keyLower === "time") {
                    timeRaw = col.toLowerCase();
                } 
                
                if (key !== "หมายเหตุ") {
                    heroObj[key] = col;
                }
            });

            // Process weakness data
            heroObj.Weakness = cols[weaknessIndex] || "";
            heroObj.time_raw = timeRaw || "";
            
            // Convert time to numeric value
            heroObj.time = this.convertTimeToNumber(timeRaw);
            
            this.heroDataList.push(heroObj);
        }

        this.heroDataList.sort((a, b) => a.Hero.localeCompare(b.Hero));
    }

    /**
     * Convert time string to numeric value
     */
    convertTimeToNumber(timeRaw) {
        if (timeRaw === "all" || timeRaw === "early/mid") return 1;
        if (timeRaw === "mid/late") return 2;
        if (timeRaw === "late") return 3;
        return 1;
    }

    /**
     * Bind events to game elements
     */
    bindEventsToGame(index) {
        const gameWrapper = document.querySelector(`.game[data-index="${index}"]`);
        if (!gameWrapper) return;

        const gallery = gameWrapper.querySelector("#hero-gallery");
        const chooseBoxes = gameWrapper.querySelectorAll(".hero-choose");
        const filterButtons = gameWrapper.querySelectorAll('#lane-filter button');
        const searchInput = gameWrapper.querySelector(`#hero-search-${index}`);
        
        const gameState = {
            selectedLanes: new Set(),
            selectedTypes: new Set(),
            searchText: "",
            isShowingWeakness: new Map()
        };

        this.gameStates.set(index, gameState);

        // Hero selection boxes
        chooseBoxes.forEach(box => {
            this.bindHeroBoxEvents(box, gallery, gameState);
        });

        // Filter buttons
        filterButtons.forEach(button => {
            this.bindFilterButtonEvents(button, gallery, gameState);
        });

        // Search input
        if (searchInput) {
            this.bindSearchEvents(searchInput, gallery, gameState);
        }

        // Mobile quick buttons
        this.addMobileQuickButtons(gameWrapper, index);
        
        // Add click event to hide popup when clicking outside
        gameWrapper.addEventListener('click', (e) => {
            // ถ้าคลิกที่พื้นที่ว่าง (ไม่ใช่ hero หรือ popup)
            if (!e.target.closest('.hero-wrapper') && 
                !e.target.closest('.team-selection-popup') && 
                !e.target.closest('.hero-choose') &&
                this.selectedHero) {
                // ยกเลิกการเลือกฮีโร่
                if (this.selectedElement) {
                    this.selectedElement.style.outline = "none";
                }
                this.selectedHero = null;
                this.selectedElement = null;
                this.hideTeamSelectionPopup();
            }
        });
    }

    /**
     * Bind events to hero selection boxes
     */
    bindHeroBoxEvents(box, gallery, gameState) {
        const originalImg = box.querySelector("img");
        const boxId = box.id;
        
        // Handle click and touch events
        const handleInteraction = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const imgInBox = box.querySelector("img");
            
            if (imgInBox && imgInBox.alt) {
                const heroName = imgInBox.alt;
                const isShowingWeakness = gameState.isShowingWeakness.get(boxId) || false;
                
                if (!isShowingWeakness) {
                    this.showHeroWeakness(heroName, imgInBox, gallery, boxId, gameState);
                } else {
                    this.hideHeroWeakness(heroName, imgInBox, originalImg, gallery, boxId, gameState);
                }
            } else if (this.selectedHero && this.selectedElement) {
                this.selectHeroToBox(imgInBox, boxId, gameState);
            }
            
            this.updateTeam();
        };
        
        // Add both click and touch events for better mobile support
        box.addEventListener("click", handleInteraction);
        box.addEventListener("touchend", handleInteraction);
        
        // Add visual feedback for touch devices
        box.addEventListener("touchstart", (e) => {
            e.preventDefault();
            box.style.transform = "scale(0.95)";
            box.style.opacity = "0.8";
        });
        
        box.addEventListener("touchend", () => {
            setTimeout(() => {
                box.style.transform = "scale(1)";
                box.style.opacity = "1";
            }, 150);
        });
    }

    /**
     * Show hero weakness information
     */
    showHeroWeakness(heroName, imgInBox, gallery, boxId, gameState) {
        imgInBox.style.border = "3px solid red";
        gameState.isShowingWeakness.set(boxId, true);
        
        const heroObj = this.heroDataList.find(h => h.Hero === heroName);
        const weaknessList = this.parseWeaknessList(heroObj?.Weakness || "");
        const counterHeroes = this.getCounterHeroes(weaknessList);
        
        this.initGallery(counterHeroes, gallery, true);
    }

    /**
     * Hide hero weakness information
     */
    hideHeroWeakness(heroName, imgInBox, originalImg, gallery, boxId, gameState) {
        const galleryImg = Array.from(gallery.querySelectorAll("img")).find(img => img.alt === heroName);
        if (galleryImg) {
            galleryImg.style.display = "inline-block";
        }
        
        imgInBox.src = originalImg.dataset.default;
        imgInBox.alt = "";
        imgInBox.style.border = "1px solid #000";
        gameState.isShowingWeakness.set(boxId, false);
        
        this.initGallery(this.heroDataList, gallery, true);
    }

    /**
     * Select hero to box
     */
    selectHeroToBox(imgInBox, boxId, gameState) {
        imgInBox.src = `./asset/hero/${this.selectedHero}.webp`;
        imgInBox.alt = this.selectedHero;
        this.selectedElement.style.display = "none";
        this.selectedElement.style.outline = "none";
        this.selectedHero = null;
        this.selectedElement = null;
        gameState.isShowingWeakness.set(boxId, false);
        
        // ซ่อน popup เลือกทีมหลังจากเลือกฮีโร่เข้าทีมแล้ว
        this.hideTeamSelectionPopup();
    }

    /**
     * Parse weakness list from string
     */
    parseWeaknessList(weaknessString) {
        if (!weaknessString) return [];
        return weaknessString.split(/[,/ ]/).map(s => s.trim()).filter(Boolean);
    }

    /**
     * Get counter heroes based on weakness list
     */
    getCounterHeroes(weaknessList) {
        const result = [];
        
        // Add special items
        if (weaknessList.includes("Soul_Scroll")) {
            result.push({ Hero: "Soul_Scroll" });
        }
        if (weaknessList.includes("Sight")) {
            result.push({ Hero: "Sight" });
        }
        
        // Filter heroes from weakness list
        const filtered = this.heroDataList.filter(h => weaknessList.includes(h.Hero));
        filtered.sort((a, b) => a.Hero.localeCompare(b.Hero));
        
        return [...result, ...filtered];
    }

    /**
     * Bind filter button events
     */
    bindFilterButtonEvents(button, gallery, gameState) {
        const handleFilterClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const lane = button.dataset.lane;
            const type = button.dataset.type;
            const isActive = button.classList.toggle("active");
            
            if (lane) {
                isActive ? gameState.selectedLanes.add(lane) : gameState.selectedLanes.delete(lane);
            }
            if (type) {
                isActive ? gameState.selectedTypes.add(type) : gameState.selectedTypes.delete(type);
            }
            
            this.filterAndShow(gallery, gameState);
        };
        
        // Add both click and touch events
        button.addEventListener('click', handleFilterClick);
        button.addEventListener('touchend', handleFilterClick);
        
        // Add touch feedback
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            button.style.transform = 'scale(0.95)';
            button.style.opacity = '0.8';
        });
        
        button.addEventListener('touchend', () => {
            setTimeout(() => {
                button.style.transform = 'scale(1)';
                button.style.opacity = '1';
            }, 150);
        });
    }

    /**
     * Bind search input events
     */
    bindSearchEvents(searchInput, gallery, gameState) {
        // Debounce search input
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                gameState.searchText = e.target.value;
                this.filterAndShow(gallery, gameState);
            }, 300);
        });
    }

    /**
     * Filter and show heroes based on current filters
     */
    filterAndShow(gallery, gameState) {
        const filtered = this.heroDataList.filter(h => {
            const matchLane = gameState.selectedLanes.size === 0 || 
                [...gameState.selectedLanes].every(l =>
                    h.Lane && h.Lane.toLowerCase().includes(l.toLowerCase())
                );
            
            const matchType = gameState.selectedTypes.size === 0 || 
                [...gameState.selectedTypes].every(t => this.matchTypeFilter(h, t));
            
            const matchSearch = !gameState.searchText || 
                (h.Hero && h.Hero.toLowerCase().includes(gameState.searchText.toLowerCase()));
            
            return matchLane && matchType && matchSearch;
        });
        
        this.initGallery(filtered, gallery, true);
    }

    /**
     * Check if hero matches type filter
     */
    matchTypeFilter(hero, type) {
        switch (type) {
            case 'Early': return hero.time_raw && hero.time_raw.includes("early");
            case 'Late': return hero.time_raw && hero.time_raw.includes("late");
            case 'burst': return hero.Ability && hero.Ability.toLowerCase().includes("burst");
            case 'cc': return Number(hero.CC) >= 2;
            case 'mobility': return Number(hero.Mobility) >= 2 && hero.Ability && hero.Ability.toLowerCase().includes("dash");
            case 'dulability': return Number(hero.Dulability) >= 2;
            case 'waveclear': return hero.Ability && hero.Ability.toLowerCase().includes("wave");
            case 'hardlock': return hero.Ability && hero.Ability.toLowerCase().includes("hardlock");
            case 'sight': return hero.Ability && hero.Ability.toLowerCase().includes("sight");
            case 'push': return hero.Ability && hero.Ability.toLowerCase().includes("push");
            case 'hook': return hero.Ability && hero.Ability.toLowerCase().includes("hook");
            case 'tierS': return hero.Tier && hero.Tier.toUpperCase().includes("S");
            case 'tierA': return hero.Tier && hero.Tier.toUpperCase().includes("A");
            default: return true;
        }
    }

    /**
     * Add mobile quick buttons for easier hero selection
     */
    addMobileQuickButtons(gameWrapper, index) {
        // สร้าง popup container
        const popupContainer = document.createElement('div');
        popupContainer.className = 'team-selection-popup';
        popupContainer.style.display = 'none';
        popupContainer.innerHTML = `
            <div class="popup-overlay"></div>
            <div class="popup-content">
                <div class="popup-header">
                    <h3>เลือกทีม</h3>
                    <button class="popup-close">&times;</button>
                </div>
                <div class="popup-buttons">
                    <button class="popup-btn team1-popup-btn">
                        <span class="btn-icon">🔴</span>
                        <span class="btn-text">ทีม 1</span>
                    </button>
                    <button class="popup-btn team2-popup-btn">
                        <span class="btn-icon">🔵</span>
                        <span class="btn-text">ทีม 2</span>
                    </button>
                </div>
            </div>
        `;
        
        // เพิ่ม popup ไปที่ body
        document.body.appendChild(popupContainer);
        
        // Event listeners for popup buttons
        const team1PopupBtn = popupContainer.querySelector('.team1-popup-btn');
        const team2PopupBtn = popupContainer.querySelector('.team2-popup-btn');
        const popupClose = popupContainer.querySelector('.popup-close');
        const popupOverlay = popupContainer.querySelector('.popup-overlay');
        
        const handleTeamSelection = (teamName) => (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.selectHeroToTeam(gameWrapper, teamName, index);
            this.hideTeamSelectionPopup();
        };
        
        const handleClosePopup = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideTeamSelectionPopup();
        };
        
        // Add both click and touch events for better mobile support
        [team1PopupBtn, team2PopupBtn].forEach((btn, idx) => {
            const teamName = idx === 0 ? 'team1' : 'team2';
            
            // Click events
            btn.addEventListener('click', handleTeamSelection(teamName));
            
            // Touch events for mobile
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                btn.style.transform = 'scale(0.95)';
                btn.style.opacity = '0.8';
            });
            
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTeamSelection(teamName)(e);
                setTimeout(() => {
                    btn.style.transform = 'scale(1)';
                    btn.style.opacity = '1';
                }, 150);
            });
            
            // Prevent context menu on long press
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
        });
        
        // Close button events
        popupClose.addEventListener('click', handleClosePopup);
        popupClose.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        popupClose.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClosePopup(e);
        });
        
        // Overlay events
        popupOverlay.addEventListener('click', handleClosePopup);
        popupOverlay.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        popupOverlay.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClosePopup(e);
        });
    }

    /**
     * Show team selection popup
     */
    showTeamSelectionPopup() {
        const popup = document.querySelector('.team-selection-popup');
        if (popup) {
            popup.style.display = 'block';
            // เพิ่ม animation
            setTimeout(() => {
                popup.classList.add('show');
            }, 10);
        }
    }

    /**
     * Hide team selection popup
     */
    hideTeamSelectionPopup() {
        const popup = document.querySelector('.team-selection-popup');
        if (popup) {
            popup.classList.remove('show');
            setTimeout(() => {
                popup.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Select hero to specific team
     */
    selectHeroToTeam(gameWrapper, teamName, index) {
        if (this.selectedHero && this.selectedElement) {
            const teamBoxes = gameWrapper.querySelectorAll(`#${teamName}-container .hero-choose`);
            const gameState = this.gameStates.get(index);
            
            for (let box of teamBoxes) {
                const imgInBox = box.querySelector("img");
                if (!imgInBox.alt) {
                    imgInBox.src = `./asset/hero/${this.selectedHero}.webp`;
                    imgInBox.alt = this.selectedHero;
                    this.selectedElement.style.display = "none";
                    this.selectedElement.style.outline = "none";
                    this.selectedHero = null;
                    this.selectedElement = null;
                    gameState.isShowingWeakness.set(box.id, false);
                    break;
                }
            }
            this.updateTeam();
            
            // ซ่อน popup เลือกทีมหลังจากเลือกทีมแล้ว
            this.hideTeamSelectionPopup();
        }
    }

    /**
     * Initialize hero gallery
     */
    initGallery(heroList, targetGallery, hideSelected = true) {
        const gallery = targetGallery || document.querySelector("#hero-gallery");
        if (!gallery) return;
        
        gallery.innerHTML = "";

        const currentGameWrapper = document.querySelector(`.game[data-index="${this.currentGameIndex}"]`);
        const team1Boxes = currentGameWrapper.querySelectorAll("#team1-container .hero-choose img");
        const team2Boxes = currentGameWrapper.querySelectorAll("#team2-container .hero-choose img");

        const newTeam1 = Array.from(team1Boxes).map(img => img.alt).filter(Boolean);
        const newTeam2 = Array.from(team2Boxes).map(img => img.alt).filter(Boolean);
        const chosenHeroes = [...newTeam1, ...newTeam2];

        // Set up gallery layout based on device
        this.updateGalleryLayout(gallery);

        heroList.forEach(heroObj => {
            const hero = heroObj.Hero;
            const wrapper = document.createElement("div");
            wrapper.className = "hero-wrapper";
            
            const img = document.createElement("img");
            img.src = `./asset/hero/${hero}.webp`;
            img.alt = hero;
            img.title = hero;
            img.style.width = "var(--hero-size)";
            img.style.height = "var(--hero-size)";
            img.style.border = "1px solid #000";
            img.style.cursor = "pointer";
            img.style.transition = "transform var(--transition-duration) ease, opacity var(--transition-duration) ease";
            img.style.borderRadius = "var(--border-radius)";

            // Hide selected heroes
            if (hideSelected && chosenHeroes.includes(hero)) {
                img.style.display = "none";
            }

            wrapper.appendChild(img);
            
            // Enhanced touch and click handling
            const handleHeroSelection = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectHero(img);
            };
            
            img.addEventListener("click", handleHeroSelection);
            img.addEventListener("touchend", handleHeroSelection);
            
            // Touch feedback
            img.addEventListener("touchstart", (e) => {
                e.preventDefault();
                img.style.transform = "scale(0.9)";
                img.style.opacity = "0.7";
            });
            
            img.addEventListener("touchend", () => {
                setTimeout(() => {
                    img.style.transform = "scale(1)";
                    img.style.opacity = "1";
                }, 150);
            });
            
            gallery.appendChild(wrapper);
        });
    }

    /**
     * Select hero from gallery
     */
    selectHero(img) {
        if (this.selectedElement) {
            this.selectedElement.style.outline = "none";
        }
        this.selectedHero = img.alt;
        this.selectedElement = img;
        img.style.outline = "3px solid red";
        
        // แสดง popup เลือกทีมเมื่อมีการเลือกฮีโร่
        this.showTeamSelectionPopup();
    }

    /**
     * Handle errors gracefully
     */
    handleError(message, error) {
        console.error(message, error);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-container';
        errorDiv.innerHTML = `
            <div class="error-content">
                <h3>เกิดข้อผิดพลาด</h3>
                <p>${message}</p>
                <button onclick="location.reload()">ลองใหม่</button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
    }


    /**
     * Update team statistics and analysis
     */
    updateTeam() {
        const currentGameWrapper = document.querySelector(`.game[data-index="${this.currentGameIndex}"]`);
        const team1Boxes = currentGameWrapper.querySelectorAll("#team1-container .hero-choose img");
        const team2Boxes = currentGameWrapper.querySelectorAll("#team2-container .hero-choose img");
        const newTeam1 = Array.from(team1Boxes).map(img => img.alt).filter(alt => alt);
        const newTeam2 = Array.from(team2Boxes).map(img => img.alt).filter(alt => alt);

        const displayContainer = currentGameWrapper.querySelector(".display");
        displayContainer.innerHTML = "";

        // Calculate team statistics
        const team1Stats = this.calculateTeamStats(newTeam1);
        const team2Stats = this.calculateTeamStats(newTeam2);

        // Display team comparison
        this.displayTeamComparison(displayContainer, team1Stats, team2Stats, newTeam1, newTeam2);

        // Show warnings
        this.showTeamWarnings(displayContainer, team1Stats, team2Stats);
    }

    /**
     * Calculate team statistics
     */
    calculateTeamStats(teamHeroes) {
        let cc = 0, damage = 0, durability = 0, time = 0;
        let typeCount = { "กายภาพ": 0, "เวท": 0, "จริง": 0 };
        let magicCount = 0;

        teamHeroes.forEach(heroName => {
            const hero = this.heroDataList.find(h => h.Hero === heroName);
            if (hero) {
                cc += Number(hero.CC || 0);
                damage += Number(hero.Damage || 0);
                durability += Number(hero.Dulability || 0);
                time += Number(hero.time || 0);
                
                const type = hero["Damage Type"]?.trim().toLowerCase();
                if (type === "magic damage") {
                    typeCount["เวท"]++;
                    magicCount++;
                } else if (type === "physical damage") {
                    typeCount["กายภาพ"]++;
                } else if (type === "true damage") {
                    typeCount["จริง"]++;
                }
            }
        });

        // Determine dominant damage type
        let maxType = "N/A", maxCount = 0, maxTypes = [];
        for (let type in typeCount) {
            if (typeCount[type] > maxCount) {
                maxCount = typeCount[type];
                maxTypes = [type];
            } else if (typeCount[type] === maxCount && maxCount > 0) {
                maxTypes.push(type);
            }
        }
        if (maxTypes.length === 1) maxType = maxTypes[0];
        else if (maxTypes.length > 1) maxType = "ผสม";

        return {
            cc, damage, durability, time, maxType, magicCount, typeCount
        };
    }

    /**
     * Display team comparison
     */
    displayTeamComparison(container, team1Stats, team2Stats, team1Heroes, team2Heroes) {
        this.setStatRow(container, "Team 1", "Team 2");
        this.setStatRow(container, `CC: ${this.getCCLabel(team1Stats.cc)}`, `CC: ${this.getCCLabel(team2Stats.cc)}`);
        this.setStatRow(container, `ดาเมจรวม: ${this.getDmgLabel(team1Stats.damage)}`, `ดาเมจรวม: ${this.getDmgLabel(team2Stats.damage)}`);
        this.setStatRow(container, `ความอึด: ${this.getDefLabel(team1Stats.durability)}`, `ความอึด: ${this.getDefLabel(team2Stats.durability)}`);
        this.setStatRow(container, `ประเภทดาเมจ: ${team1Stats.maxType}`, `ประเภทดาเมจ: ${team2Stats.maxType}`);
        this.setStatRow(container, `เกมช่วง: ${this.getTimeLabel(team1Stats.time)}`, `เกมช่วง: ${this.getTimeLabel(team2Stats.time)}`);
        
        // Display hero images
        this.setStatRow(
            container,
            this.createHeroImagesHTML(team1Heroes, "team1"),
            this.createHeroImagesHTML(team2Heroes, "team2")
        );

        // Add click events to hero images
        setTimeout(() => {
            this.addHeroImageClickEvents(container);
        }, 0);
    }

    /**
     * Create HTML for hero images
     */
    createHeroImagesHTML(heroes, teamClass) {
        return heroes.map(hero => 
            `<img src="./asset/hero/${hero}.webp" alt="${hero}" title="${hero}" 
                 style="width:32px;height:32px;vertical-align:middle;margin-right:4px;border:1px solid #888;border-radius:4px;cursor:pointer;" 
                 class="${teamClass}-hero-img">`
        ).join("");
    }

    /**
     * Add click events to hero images in display
     */
    addHeroImageClickEvents(container) {
        const imgs = container.querySelectorAll('.team1-hero-img, .team2-hero-img');
        const gallery = document.querySelector(`.game[data-index="${this.currentGameIndex}"] #hero-gallery`);

        imgs.forEach(img => {
            img.addEventListener('click', () => {
                const heroName = img.alt;
                const heroObj = this.heroDataList.find(h => h.Hero === heroName);
                const weaknessList = this.parseWeaknessList(heroObj?.Weakness || "");
                const counterHeroes = this.getCounterHeroes(weaknessList);
                this.initGallery(counterHeroes.length ? counterHeroes : [], gallery, true);
            });
        });
    }

    /**
     * Show team warnings
     */
    showTeamWarnings(container, team1Stats, team2Stats) {
        const warnings = [];

        if (team1Stats.magicCount >= 3) {
            warnings.push("ดาเมจเวทมากเกินไป");
        }

        // Check for invisible heroes vs sight
        const currentGameWrapper = document.querySelector(`.game[data-index="${this.currentGameIndex}"]`);
        const team2Boxes = currentGameWrapper.querySelectorAll("#team2-container .hero-choose img");
        const team1Boxes = currentGameWrapper.querySelectorAll("#team1-container .hero-choose img");

        const team2HasInvisible = Array.from(team2Boxes).some(img => {
            const hero = this.heroDataList.find(h => h.Hero === img.alt);
            return hero?.Ability?.toLowerCase().includes("invisible");
        });

        const team1HasSight = Array.from(team1Boxes).some(img => {
            const hero = this.heroDataList.find(h => h.Hero === img.alt);
            return hero?.Ability?.toLowerCase().includes("sight");
        });

        if (team2HasInvisible && !team1HasSight) {
            warnings.push("ต้องการ hero เปิดแมพ");
        }

        if (warnings.length > 0) {
            const warningContainer = document.createElement("div");
            warningContainer.className = "warning-container";
            warnings.forEach(text => {
                const p = document.createElement("p");
                p.className = "stat-text cc-warning";
                p.textContent = text;
                warningContainer.appendChild(p);
            });
            container.appendChild(warningContainer);
        }
    }

    /**
     * Set stat row in display
     */
    setStatRow(displayEl, team1Text, team2Text) {
        const row = document.createElement("div");
        row.className = "stat-row";

        const p1 = document.createElement("p");
        p1.className = "stat-text";
        if (team1Text.includes("<img")) {
            p1.innerHTML = team1Text;
        } else {
            p1.textContent = team1Text;
        }

        const p2 = document.createElement("p");
        p2.className = "stat-text";
        if (team2Text.includes("<img")) {
            p2.innerHTML = team2Text;
        } else {
            p2.textContent = team2Text;
        }

        row.appendChild(p1);
        row.appendChild(p2);
        displayEl.appendChild(row);
    }

    /**
     * Create initial game
     */
    createInitialGame() {
        const gameWrapper = document.createElement('div');
        gameWrapper.className = 'game';
        gameWrapper.dataset.index = '0';
        gameWrapper.innerHTML = this.getGameHTML();

        this.gameContainer.appendChild(gameWrapper);
        this.bindEventsToGame(0);
        this.initGallery(this.heroDataList);
        this.updateTeam();
    }

    /**
     * Get game HTML template
     */
    getGameHTML() {
        return `
            <div class="ban-pick" id="ban-pick-0"> 
                <div class="team-section">
                    <div class="team-label1">Team 1</div>
                    <div id="team1-container">
                        <div class="hero-choose" id="AbyssalDragon1"><img src="/asset/etc/AbyssalDragon.webp" data-default="/asset/etc/AbyssalDragon.webp"></div>
                        <div class="hero-choose" id="Support1"><img src="/asset/etc/Support.webp" data-default="/asset/etc/Support.webp"></div>
                        <div class="hero-choose" id="Mid1"><img src="/asset/etc/Mid.webp" data-default="/asset/etc/Mid.webp"></div>
                        <div class="hero-choose" id="Jungle1"><img src="/asset/etc/Jungle.webp" data-default="/asset/etc/Jungle.webp"></div>
                        <div class="hero-choose" id="DarkSlayer1"><img src="/asset/etc/DarkSlayer.webp" data-default="/asset/etc/DarkSlayer.webp"></div>
                    </div>
                </div>
                <div class="team-section">
                    <div class="team-label2">Team 2</div>
                    <div id="team2-container">
                        <div class="hero-choose" id="AbyssalDragon2"><img src="/asset/etc/AbyssalDragon.webp" data-default="/asset/etc/AbyssalDragon.webp"></div>
                        <div class="hero-choose" id="Support2"><img src="/asset/etc/Support.webp" data-default="/asset/etc/Support.webp"></div>
                        <div class="hero-choose" id="Mid2"><img src="/asset/etc/Mid.webp" data-default="/asset/etc/Mid.webp"></div>
                        <div class="hero-choose" id="Jungle2"><img src="/asset/etc/Jungle.webp" data-default="/asset/etc/Jungle.webp"></div>
                        <div class="hero-choose" id="DarkSlayer2"><img src="/asset/etc/DarkSlayer.webp" data-default="/asset/etc/DarkSlayer.webp"></div>
                    </div>
                </div>
            </div>
            <div class="content" id="content-0">
                <div class="hero-select">
                    <div id="lane-filter" style="margin-bottom: 10px;">
                        <button data-lane="Abyssal">Abyssal</button>
                        <button data-lane="Support">Support</button>
                        <button data-lane="Mid">Mid</button>
                        <button data-lane="Jungle">Jungle</button>
                        <button data-lane="DarkSlayer">Dark</button>
                        <button data-type="Early">ต้น</button>
                        <button data-type="Late">เลท</button>
                        <button data-type="burst">เบิร์ส</button>
                        <button data-type="cc">CC</button>
                        <button data-type="dulability">อึด</button>
                        <button data-type="waveclear">Wave</button>
                        <button data-type="hardlock">จับตาย</button>
                        <button data-type="sight">เปิดแมพ</button>
                        <button data-type="push">ผลัก</button>
                        <button data-type="hook">เกี่ยว</button>
                        <button data-type="tierS">S</button>
                        <button data-type="tierA">A</button>
                    </div>
                    <input type="text" id="hero-search-0" placeholder="ค้นหาชื่อฮีโร่..." style="margin-bottom:10px;width:100%;max-width:300px;">
                    <div id="hero-gallery" style="display: flex; flex-wrap: wrap; gap: 10px;"></div>
                </div>
                <div class="display"></div>
            </div>
        `;
    }

    // Utility functions for labels
    getDefLabel(def) {
        if (def === 0) return " ";
        if (def < 7) return "บาง";
        if (def < 12) return "ปานกลาง";
        return "ถึก";
    }

    getDmgLabel(dmg) {
        if (dmg === 0) return " ";
        if (dmg < 12) return "น้อย";
        if (dmg <= 15) return "ปานกลาง";
        if (dmg <= 21) return "เยอะ";
        return "ล้น";
    }

    getCCLabel(CC) {
        if (CC === 0) return " ";
        if (CC < 5) return "น้อย";
        if (CC <= 9) return "ปานกลาง";
        return "เยอะ";
    }

    getTimeLabel(time) {
        if (time === 0) return " ";
        if (time < 7) return "ทีมต้นเกม";
        if (time <= 12) return "ทีมกลางเกม";
        return "ทีมเลทเกม";
    }
}

// Initialize application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    const draftHelper = new DraftHelper();
    draftHelper.init();
});
