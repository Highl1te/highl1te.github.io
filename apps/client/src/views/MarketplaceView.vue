<template>
  <div class="marketplace-container">
    <div class="marketplace-header">
      <div class="header-content">
        <div class="title-section">
          <h1>
            <Icon icon="mdi:store" class="title-icon" />
            Marketplace
          </h1>
          <p>Buy and sell items with other players</p>
        </div>
        <div class="header-stats">
          <div class="stat">
            <Icon icon="mdi:package-variant" />
            <span>{{ marketplace.listings.value.length }} Active Listings</span>
          </div>
          <div class="stat">
            <Icon icon="mdi:handshake" />
            <span>{{ totalOffers }} Total Offers</span>
          </div>
        </div>
      </div>        <div class="header-actions">
          <button v-if="authStore.isAuthenticated" @click="showCreateListing = true" class="btn btn-primary btn-lg">
            <Icon icon="mdi:plus" /> Create Listing
          </button>
          <button v-else @click="authStore.login" class="btn btn-primary btn-lg">
            <Icon icon="mdi:login" /> Login to Trade
          </button>
        </div>
    </div>

    <!-- Create Listing Modal -->
    <div v-if="showCreateListing" class="modal-overlay" @click="showCreateListing = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Create New Listing</h2>
          <button @click="showCreateListing = false" class="close-btn">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Listing Type:</label>
            <div class="listing-type-selector">
              <label class="radio-option">
                <input type="radio" v-model="newListing.listingType" value="selling">
                <span class="radio-label">
                  <Icon icon="mdi:tag" />
                  <strong>Selling</strong>
                </span>
              </label>
              <label class="radio-option">
                <input type="radio" v-model="newListing.listingType" value="buying">
                <span class="radio-label">
                  <Icon icon="mdi:cash" />
                  <strong>Buying</strong>
                </span>
              </label>
            </div>
          </div>
          
          <div class="form-group">
            <label>Select Item:</label>
            <ItemSelector
              v-model="newListing.itemId"
              :items="tradeableItems"
              :placeholder="newListing.listingType === 'buying' ? 'Choose an item to buy...' : 'Choose an item to sell...'"
              @change="updateSelectedItem"
            />
          </div>

          <div class="form-group">
            <label>Quantity:</label>
            <div class="quantity-selector">
              <div class="quantity-type-buttons">
                <button 
                  type="button"
                  @click="newListing.isInfinite = false"
                  :class="['quantity-type-btn', { active: !newListing.isInfinite }]"
                >
                  <Icon icon="mdi:numeric" />
                  <span>Specific Amount</span>
                </button>
                <button 
                  type="button"
                  @click="toggleInfiniteQuantity"
                  :class="['quantity-type-btn', { active: newListing.isInfinite }]"
                >
                  <Icon icon="mdi:infinity" />
                  <span>Unlimited</span>
                </button>
              </div>
              <div v-if="!newListing.isInfinite" class="quantity-input-container">
                <input type="number" v-model="newListing.quantity" min="1" placeholder="1">
              </div>
              <div v-else class="infinite-quantity-info">
                <Icon icon="mdi:information" />
                <span>Unlimited quantity - {{ newListing.listingType === 'buying' ? 'buyers' : 'sellers' }} can request any amount</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>
              {{ newListing.listingType === 'buying' ? 'Offering Price' : 'Asking Price' }}
              {{ newListing.acceptsPartialOffers ? '(per item)' : newListing.quantity > 1 ? '(total for ' + newListing.quantity + ' items)' : '(per item)' }}:
            </label>
            <div class="price-input-container">
              <input type="number" v-model="newListing.askingPrice" min="1" placeholder="Enter price">
              <span class="price-unit">coins</span>
            </div>
            <div v-if="newListing.acceptsPartialOffers" class="price-explanation">
              <Icon icon="mdi:information-outline" />
              <span>Price is per individual item. {{ newListing.listingType === 'buying' ? 'Sellers' : 'Buyers' }} can request any quantity at this rate.</span>
            </div>
          </div>

          <div class="form-group">
            <label>Trade Options:</label>
            <div class="toggle-buttons-group">
              <button 
                v-if="newListing.listingType === 'selling'"
                type="button"
                @click="newListing.acceptsItems = !newListing.acceptsItems"
                :class="['toggle-btn', { active: newListing.acceptsItems }]"
              >
                <Icon icon="mdi:swap-horizontal" />
                <span>Accept item trades of equivalent value</span>
              </button>
              <button 
                type="button"
                @click="!newListing.isInfinite && (newListing.acceptsPartialOffers = !newListing.acceptsPartialOffers)"
                :class="['toggle-btn', { 
                  active: newListing.acceptsPartialOffers,
                  disabled: newListing.isInfinite 
                }]"
                :disabled="newListing.isInfinite"
              >
                <Icon icon="mdi:chart-box-multiple-outline" />
                <span>Accept partial quantity offers</span>
                <span v-if="newListing.isInfinite" class="required-badge">Required</span>
              </button>
            </div>
            <div v-if="newListing.isInfinite" class="infinite-notice">
              <Icon icon="mdi:information" />
              <span>Partial offers are automatically enabled for unlimited quantity listings</span>
            </div>
          </div>

          <div class="form-group">
            <label>Additional Notes (optional):</label>
            <textarea v-model="newListing.notes" placeholder="Any additional information..."></textarea>
          </div>

          <div class="modal-actions">
            <button @click="showCreateListing = false" class="btn btn-ghost">Cancel</button>
            <button @click="createListing" class="btn btn-primary" :disabled="!canCreateListing">
              Create Listing
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Listing Modal -->
    <div v-if="showEditListing" class="modal-overlay" @click="showEditListing = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Edit Listing</h2>
          <button @click="showEditListing = false" class="close-btn">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="modal-body" v-if="editingListing">
          <div class="item-preview">
            <div class="item-preview-header">
              <ItemIcon 
                :item-id="editingListing.item_id" 
                :item-name="getItemName(editingListing.item_id)"
                size="large"
              />
              <div class="item-preview-info">
                <h3>{{ getItemName(editingListing.item_id) }}</h3>
                <p>{{ getItemDescription(editingListing.item_id) }}</p>
                <p class="base-cost">Base cost: {{ formatAmount(getItem(editingListing.item_id)?.cost || 0) }} coins</p>
                <div class="listing-type-badge">
                  <Icon :icon="editingListing.listing_type === 'buying' ? 'mdi:cash' : 'mdi:tag'" />
                  {{ editingListing.listing_type === 'buying' ? 'BUYING' : 'SELLING' }}
                </div>
              </div>
            </div>
          </div>

          <div class="form-group" v-if="editingListing.quantity !== -1">
            <label>Quantity:</label>
            <div class="quantity-input-container">
              <input type="number" v-model="editingListing.quantity" min="1" placeholder="1">
            </div>
          </div>
          
          <div class="form-group" v-else>
            <div class="infinite-quantity-notice">
              <Icon icon="mdi:infinity" />
              <span class="infinite-label">Unlimited Quantity</span>
              <p class="infinite-description">{{ editingListing.listing_type === 'buying' ? 'Buyers' : 'Sellers' }} can request any amount</p>
            </div>
          </div>

          <div class="form-group">
            <label>
              {{ editingListing.listing_type === 'buying' ? 'Offering Price' : 'Asking Price' }}
              {{ editingListing.accepts_partial_offers ? '(per item)' : editingListing.quantity > 1 ? '(total for ' + editingListing.quantity + ' items)' : '(per item)' }}:
            </label>
            <div class="price-input-container">
              <input type="number" v-model="editingListing.asking_price" min="1" placeholder="Enter price">
              <span class="price-unit">coins</span>
            </div>
            <div v-if="editingListing.quantity === -1" class="price-explanation">
              <Icon icon="mdi:information-outline" />
              <span>Price is per individual item. {{ editingListing.listing_type === 'buying' ? 'Sellers' : 'Buyers' }} can request any quantity at this rate.</span>
            </div>
          </div>

          <div class="form-group">
            <label>Trade Options:</label>
            <div class="toggle-buttons-group">
              <button 
                v-if="editingListing.listing_type === 'selling'"
                type="button"
                @click="editingListing.accepts_items = !editingListing.accepts_items"
                :class="['toggle-btn', { active: editingListing.accepts_items }]"
              >
                <Icon icon="mdi:swap-horizontal" />
                <span>Accept item trades of equivalent value</span>
              </button>
              <button 
                v-if="editingListing.quantity !== -1"
                type="button"
                @click="editingListing.accepts_partial_offers = !editingListing.accepts_partial_offers"
                :class="['toggle-btn', { active: editingListing.accepts_partial_offers }]"
              >
                <Icon icon="mdi:chart-box-multiple-outline" />
                <span>Accept partial quantity offers</span>
              </button>
            </div>
            <div v-if="editingListing.quantity === -1" class="automatic-partial-notice">
              <Icon icon="mdi:information" />
              <span>Partial offers are automatically enabled for unlimited quantity listings</span>
            </div>
          </div>

          <div class="form-group">
            <label>Additional Notes (optional):</label>
            <textarea v-model="editingListing.notes" placeholder="Any additional information..."></textarea>
          </div>

          <div class="modal-actions">
            <button @click="showEditListing = false" class="btn btn-ghost">Cancel</button>
            <button @click="updateListing" class="btn btn-primary" :disabled="!canUpdateListing">
              Update Listing
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Search and Type Filter Bar -->
    <div class="search-and-filters-bar">
      <!-- Search Input -->
      <div class="search-container">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input 
          v-model="searchQuery" 
          placeholder="Search items..." 
          class="search-input"
        >
        <button 
          v-if="searchQuery" 
          @click="searchQuery = ''"
          class="clear-search-btn"
        >
          <Icon icon="mdi:close" />
        </button>
      </div>

      <!-- Listing Type Filter -->
      <div class="listing-type-filter">
        <label>Show:</label>
        <select v-model="listingTypeFilter" class="listing-type-select">
          <option value="all">All Listings</option>
          <option value="selling">For Sale</option>
          <option value="buying">Buying Requests</option>
        </select>
      </div>
    </div>

    <!-- Listings -->
    <div class="listings-section">
      <!-- Pending Trades Section -->
      <div v-if="authStore.isAuthenticated && marketplace.pendingTrades.value.length > 0" class="pending-trades-section">
        <div class="section-header">
          <h3>
            <Icon icon="mdi:clock-outline" />
            Pending Trades ({{ marketplace.pendingTrades.value.length }})
          </h3>
        </div>
        <div class="pending-trades-grid">
          <div v-for="trade in marketplace.pendingTrades.value" :key="trade.id" class="pending-trade-card">
            <div class="trade-header">
              <div class="trade-status">
                <Icon icon="mdi:handshake" />
                <span>{{ trade.user_role === 'seller' ? 'Selling' : 'Buying' }}</span>
              </div>
              <div class="trade-confirmations">
                <div :class="['confirmation-badge', { confirmed: trade.seller_confirmed }]">
                  <Icon :icon="trade.seller_confirmed ? 'mdi:check' : 'mdi:clock-outline'" />
                  Seller
                </div>
                <div :class="['confirmation-badge', { confirmed: trade.buyer_confirmed }]">
                  <Icon :icon="trade.buyer_confirmed ? 'mdi:check' : 'mdi:clock-outline'" />
                  Buyer
                </div>
              </div>
            </div>
            
            <div class="trade-details">
              <div class="trade-item">
                <ItemIcon 
                  :item-id="trade.item_id" 
                  :item-name="getItemName(trade.item_id)"
                  size="medium"
                />
                <div class="trade-item-info">
                  <h4>{{ getItemName(trade.item_id) }}</h4>
                  <p>{{ trade.quantity }}x - {{ formatAmount(trade.asking_price) }} coins</p>
                </div>
              </div>
              
              <div class="trade-offer">
                <div v-if="trade.coin_offer > 0" class="coin-offer">
                  <Icon icon="mdi:coin" />
                  <span>{{ formatAmount(trade.coin_offer) }} coins</span>
                </div>
                <div v-if="trade.item_offers && trade.item_offers.length > 0" class="item-offers">
                  <div v-for="itemOffer in trade.item_offers" :key="itemOffer.id" class="offered-item">
                    <ItemIcon 
                      :item-id="itemOffer.item_id" 
                      :item-name="getItemName(itemOffer.item_id)"
                      size="small"
                    />
                    <span>{{ itemOffer.quantity }}x {{ getItemName(itemOffer.item_id) }}</span>
                  </div>
                </div>
              </div>
              
              <div class="trade-parties">
                <div class="party seller">
                  <Icon icon="mdi:account" />
                  <span>{{ trade.seller_name }}</span>
                </div>
                <Icon icon="mdi:arrow-right" />
                <div class="party buyer">
                  <Icon icon="mdi:account-outline" />
                  <span>{{ trade.buyer_name }}</span>
                </div>
              </div>
            </div>
            
            <div class="trade-actions">
              <div v-if="!trade.seller_confirmed && !trade.buyer_confirmed" class="trade-warning">
                <Icon icon="mdi:information" />
                <span>Both parties need to confirm the trade completion. You can cancel this trade until someone confirms.</span>
              </div>
              <div v-else-if="trade.seller_confirmed && trade.buyer_confirmed" class="trade-completed">
                <Icon icon="mdi:check-circle" />
                <span>Trade completed!</span>
              </div>
              <div v-else class="trade-waiting">
                <Icon icon="mdi:clock-outline" />
                <span v-if="trade.user_role === 'seller' && trade.seller_confirmed">
                  Waiting for buyer to confirm
                </span>
                <span v-else-if="trade.user_role === 'buyer' && trade.buyer_confirmed">
                  Waiting for seller to confirm
                </span>
                <span v-else>
                  Please confirm when the trade is complete
                </span>
              </div>
              
              <div class="trade-buttons">
                <button 
                  v-if="(trade.user_role === 'seller' && !trade.seller_confirmed) || (trade.user_role === 'buyer' && !trade.buyer_confirmed)"
                  @click="confirmTrade(trade.id)"
                  class="btn btn-success"
                >
                  <Icon icon="mdi:check" />
                  Confirm Trade
                </button>
                <button 
                  v-if="!trade.seller_confirmed && !trade.buyer_confirmed"
                  @click="cancelTrade(trade.id)"
                  class="btn btn-danger btn-sm"
                  title="Cancel this trade and return the listing to active status"
                >
                  <Icon icon="mdi:close" />
                  Cancel Trade
                </button>
              </div>
            </div>
            
            <div class="trade-meta">
              <span class="trade-date">{{ getRelativeTime(trade.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="filteredListings.length === 0" class="empty-state">
        <Icon icon="mdi:package-variant-closed" class="empty-icon" />
        <h3>No listings found</h3>
        <p>Try adjusting your filters or be the first to create a listing!</p>
        <button v-if="authStore.isAuthenticated" @click="showCreateListing = true" class="btn btn-primary btn-spaced">
          <Icon icon="mdi:plus" /> Create First Listing
        </button>
        <button v-else @click="authStore.login" class="btn btn-primary btn-spaced">
          <Icon icon="mdi:login" /> Login to Create Listing
        </button>
      </div>

      <!-- Listings Table -->
      <div v-if="filteredListings.length > 0" class="listings-table-container">
        <table class="listings-table">
          <thead>
            <tr>
              <th class="item-column">Item</th>
              <th class="quantity-column sortable" @click="sortByColumn('quantity')">
                <span>
                  Quantity
                  <Icon 
                    :icon="sortColumn === 'quantity' && sortDirection === 'desc' ? 'mdi:arrow-down' : 'mdi:arrow-up'" 
                    :style="{ opacity: sortColumn === 'quantity' ? 1 : 0.4 }"
                  />
                </span>
              </th>
              <th class="price-column sortable" @click="sortByColumn('price')">
                <span>
                  Price
                  <Icon 
                    :icon="sortColumn === 'price' && sortDirection === 'desc' ? 'mdi:arrow-down' : 'mdi:arrow-up'" 
                    :style="{ opacity: sortColumn === 'price' ? 1 : 0.4 }"
                  />
                </span>
              </th>
              <th class="offers-column sortable" @click="sortByColumn('offers')">
                <span>
                  Offers
                  <Icon 
                    :icon="sortColumn === 'offers' && sortDirection === 'desc' ? 'mdi:arrow-down' : 'mdi:arrow-up'" 
                    :style="{ opacity: sortColumn === 'offers' ? 1 : 0.4 }"
                  />
                </span>
              </th>
              <th class="actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="listing in filteredListings" 
                :key="listing.id"
                :data-listing-id="listing.id"
                class="listing-row"
                :class="{ 
                  'own-listing': isOwnListing(listing),
                  'buying-listing': listing.listing_type === 'buying',
                  'selling-listing': listing.listing_type === 'selling',
                  'infinite-listing': isInfiniteListing(listing)
                }"
                @click="viewOffers(listing)"
                style="cursor: pointer">
              
              <!-- Item Column -->
              <td class="item-cell">
                <div class="item-info">
                  <div class="item-icon-container">
                    <ItemIcon 
                      :item-id="listing.item_id" 
                      :item-name="getItemName(listing.item_id)"
                      size="medium"
                    />
                  </div>
                  <div class="item-details">
                    <h4 class="item-name" 
                        :data-type="listing.listing_type.toUpperCase()" 
                        :data-quantity="listing.quantity === -1 ? '∞' : listing.quantity + 'x'">
                      {{ getItemName(listing.item_id) }}
                    </h4>
                    <div class="listing-type-and-features">
                      <div class="listing-type-label" :class="listing.listing_type">
                        <Icon :icon="listing.listing_type === 'buying' ? 'mdi:cash' : 'mdi:tag'" />
                        <span>{{ listing.listing_type === 'buying' ? 'Buying Request' : 'For Sale' }}</span>
                        <div v-if="isOwnListing(listing)" class="owner-indicator">
                          <Icon icon="mdi:account" />
                          <span>YOURS</span>
                        </div>
                      </div>
                      <!-- Feature badges inline with listing type -->
                      <div class="inline-feature-badges">
                        <div v-if="listing.accepts_items" class="feature-badge trades">
                          <Icon icon="mdi:swap-horizontal" />
                          Trades
                        </div>
                        <div v-if="listing.accepts_partial_offers" class="feature-badge partial">
                          <Icon icon="mdi:chart-box-multiple-outline" />
                          Partial
                        </div>
                        <div v-if="isRecentListing(listing)" class="feature-badge recent">
                          <Icon icon="mdi:new-box" />
                          New
                        </div>
                      </div>
                    </div>
                    <div class="created-by">
                      <span class="created-by-label">Created By:</span>
                      <span class="creator-name" @click.stop="showSellerProfile(listing.seller_discord_id)">
                        {{ marketplace.formatDiscordUsername(listing.seller_name, listing.seller_discriminator) }}
                      </span>
                    </div>
                    <div class="listing-age">
                      <Icon icon="mdi:clock-outline" />
                      {{ getRelativeTime(listing.created_at) }}
                    </div>
                  </div>
                </div>
              </td>

              <!-- Quantity Column -->
              <td class="quantity-cell">
                <div class="quantity-info">
                  <span class="quantity-value">
                    {{ listing.quantity === -1 ? '∞' : listing.quantity }}{{ listing.quantity === -1 ? '' : 'x' }}
                  </span>
                </div>
              </td>

              <!-- Price Column -->
              <td class="price-cell">
                <div class="price-info">
                  <div class="price-amount">
                    <Icon icon="mdi:coin" />
                    <span class="price-value">{{ formatAmount(listing.asking_price) }}</span>
                  </div>
                  <div class="price-label">
                    {{ listing.listing_type === 'buying' ? 'offered' : 'asked' }}
                    {{ listing.accepts_partial_offers ? ' per item' : '' }}
                  </div>
                </div>
              </td>

              <!-- Offers Column -->
              <td class="offers-cell">
                <div class="offers-info">
                  <span class="offers-count">{{ getOfferCount(listing.id) }}</span>
                  <div v-if="getOfferCount(listing.id) > 0" class="popular-badge">
                    <Icon icon="mdi:fire" />
                  </div>
                </div>
              </td>

              <!-- Actions Column -->
              <td class="actions-cell">
                <div class="listing-actions">
                  <button 
                    @click.stop="viewOffers(listing)" 
                    class="btn btn-secondary btn-sm"
                    :title="`View Offers (${getOfferCount(listing.id)})`"
                  >
                    <Icon icon="mdi:eye" />
                  </button>
                  <button 
                    v-if="isOwnListing(listing)" 
                    @click.stop="editListing(listing)" 
                    class="btn btn-secondary btn-sm"
                    title="Edit Listing"
                  >
                    <Icon icon="mdi:pencil" />
                  </button>
                  <button 
                    v-if="isOwnListing(listing)" 
                    @click.stop="removeListing(listing.id)" 
                    class="btn btn-danger btn-sm"
                    title="Remove Listing"
                  >
                    <Icon icon="mdi:delete" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- View Offers Modal -->
    <div v-if="showOffersModal" class="modal-overlay" @click="showOffersModal = false">
      <div class="modal offers-modal" @click.stop>
        <div class="modal-header">
          <h2>Offers for {{ selectedListingForOffers?.seller_name }}'s {{ getItemName(selectedListingForOffers?.item_id || 0) }}</h2>
          <button @click="showOffersModal = false" class="close-btn">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="modal-body" v-if="selectedListingForOffers">
          <!-- Enhanced listing summary -->
          <div class="listing-summary-enhanced">
            <div class="listing-main-info">
              <div class="item-display">
                <ItemIcon 
                  :item-id="selectedListingForOffers.item_id" 
                  :item-name="getItemName(selectedListingForOffers.item_id)"
                  size="large"
                />
                <div class="item-basic-info">
                  <div class="item-name-with-badges" style="display: flex; align-items: center; gap: 12px;">
                    <h3 class="item-name">{{ getItemName(selectedListingForOffers.item_id) }}</h3>
                    <!-- Trade Options Badges inline with item name -->
                    <div class="trade-options-badges" style="display: flex; gap: 6px;">
                      <div v-if="selectedListingForOffers.accepts_items" class="feature-badge trades">
                        <Icon icon="mdi:swap-horizontal" />
                        Trades
                      </div>
                      <div v-if="selectedListingForOffers.accepts_partial_offers" class="feature-badge partial">
                        <Icon icon="mdi:chart-box-multiple-outline" />
                        Partial
                      </div>
                    </div>
                  </div>
                  <p class="item-description">{{ getItemDescription(selectedListingForOffers.item_id) }}</p>
                  <div class="item-meta">
                    <span class="offered-price">
                      <Icon icon="mdi:tag" />
                      {{ selectedListingForOffers.listing_type === 'buying' ? 'Offered' : 'Listed' }}: {{ formatAmount(selectedListingForOffers.asking_price) }} coins{{ selectedListingForOffers.accepts_partial_offers || selectedListingForOffers.quantity === -1 ? '/ea' : '' }}
                    </span>
                    <span class="market-avg">
                      <Icon icon="mdi:chart-line" />
                      Market Avg: {{ formatAmount(getMarketStats(selectedListingForOffers.item_id).avgPrice || 0) }} coins
                    </span>
                    <span class="tradeable-status">
                      <Icon :icon="getItem(selectedListingForOffers.item_id)?.isTradeable ? 'mdi:check-circle' : 'mdi:close-circle'" />
                      {{ getItem(selectedListingForOffers.item_id)?.isTradeable ? 'Tradeable' : 'Non-tradeable' }}
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="listing-details-compact">
                <!-- Quantity -->
                <div class="detail-item-compact">
                  <div class="detail-icon-container quantity-icon">
                    <Icon icon="mdi:package-variant" />
                  </div>
                  <div class="detail-content">
                    <div class="detail-label">Quantity</div>
                    <div class="detail-value">
                      {{ selectedListingForOffers.quantity === -1 ? 'Unlimited' : `${selectedListingForOffers.quantity} items` }}
                    </div>
                  </div>
                </div>
                
                <!-- Seller Info -->
                <div class="detail-item-compact">
                  <div class="detail-icon-container seller-icon">
                    <Icon icon="mdi:account" />
                  </div>
                  <div class="detail-content">
                    <div class="detail-label">Seller</div>
                    <div 
                      class="detail-value seller-name-link" 
                      @click="showSellerProfile(selectedListingForOffers.seller_discord_id)"
                    >
                      {{ marketplace.formatDiscordUsername(selectedListingForOffers.seller_name, selectedListingForOffers.seller_discriminator) }}
                    </div>
                  </div>
                </div>
                
                <!-- Created Time -->
                <div class="detail-item-compact">
                  <div class="detail-icon-container time-icon">
                    <Icon icon="mdi:clock-outline" />
                  </div>
                  <div class="detail-content">
                    <div class="detail-label">Created</div>
                    <div class="detail-value">
                      {{ getRelativeTime(selectedListingForOffers.created_at) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Listing Notes Section -->
            <div v-if="selectedListingForOffers.notes && selectedListingForOffers.notes.trim()" class="listing-notes-section">
              <div class="listing-notes-header">
                <Icon icon="mdi:note-text" />
                <span>Seller Notes</span>
              </div>
              <div class="listing-notes-content">
                <p>{{ selectedListingForOffers.notes }}</p>
              </div>
            </div>
            
            <!-- Market Statistics (collapsible) -->
            <div class="market-stats-section">
              <button class="market-stats-toggle" @click="showMarketStats = !showMarketStats" type="button">
                <Icon :icon="showMarketStats ? 'mdi:chevron-up' : 'mdi:chart-line'" />
                <span>Market Statistics</span>
                <small>{{ showMarketStats ? 'Hide' : 'View market data for this item' }}</small>
              </button>
              
              <div v-if="showMarketStats" class="market-stats-content">
                <div class="market-stats-grid">
                  <div class="market-stat">
                    <Icon icon="mdi:storefront" />
                    <div class="stat-info">
                      <span class="stat-value">{{ getMarketStats(selectedListingForOffers.item_id).activeListings }}</span>
                      <span class="stat-label">Active Listings</span>
                    </div>
                  </div>
                  <div class="market-stat">
                    <Icon icon="mdi:trending-up" />
                    <div class="stat-info">
                      <span class="stat-value">{{ formatAmount(getMarketStats(selectedListingForOffers.item_id).avgPrice) }}</span>
                      <span class="stat-label">Average Price</span>
                    </div>
                  </div>
                  <div class="market-stat">
                    <Icon icon="mdi:chart-bar" />
                    <div class="stat-info">
                      <span class="stat-value">{{ getMarketStats(selectedListingForOffers.item_id).priceRange }}</span>
                      <span class="stat-label">Price Range</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="offers-list">
            <div class="offers-list-header">
              <h3>Offers ({{ getOffersForListing(selectedListingForOffers.id).length }})</h3>
              <button 
                v-if="!isOwnListing(selectedListingForOffers) && authStore.isAuthenticated"
                @click="showMakeOffer(selectedListingForOffers)" 
                class="btn btn-primary btn-sm"
              >
                <Icon icon="mdi:plus" />
                Make Offer
              </button>
              <button 
                v-else-if="!authStore.isAuthenticated"
                @click="authStore.login" 
                class="btn btn-primary btn-sm"
              >
                <Icon icon="mdi:login" />
                Login
              </button>
            </div>
            <div v-if="getOffersForListing(selectedListingForOffers.id).length === 0" class="no-offers">
              <Icon icon="mdi:email-outline" />
              <p>No offers yet for this listing.</p>
            </div>
            <div v-for="offer in getOffersForListing(selectedListingForOffers.id)" :key="offer.id" class="offer-card-compact">
              <!-- Offer header with buyer info -->
              <div class="offer-header-compact">
                <div class="buyer-info-compact">
                  <img 
                    :src="marketplace.getDiscordAvatarUrl(offer.buyer_discord_id, offer.buyer_avatar)" 
                    :alt="`${offer.buyer_name}'s avatar`"
                    class="buyer-avatar-small"
                    @error="(e) => (e.target as HTMLImageElement).src = marketplace.getDiscordAvatarUrl(offer.buyer_discord_id)"
                  />
                  <div class="buyer-details-compact">
                    <span class="buyer-name">{{ marketplace.formatDiscordUsername(offer.buyer_name, offer.buyer_discriminator) }}</span>
                    <span class="offer-date">{{ formatDate(offer.created_at) }}</span>
                  </div>
                </div>
                <div class="offer-value-display">
                  <span v-if="offer.coin_offer" class="coin-value">{{ formatAmount(offer.coin_offer) }} coins</span>
                  <span v-if="offer.item_offers && offer.item_offers.length > 0" class="item-count">+ {{ offer.item_offers.length }} item{{ offer.item_offers.length > 1 ? 's' : '' }}</span>
                </div>
              </div>
              
              <!-- Offer details (collapsed by default) -->
              <div class="offer-details-compact">
                <div v-if="offer.item_offers && offer.item_offers.length > 0" class="offered-items-compact">
                  <div v-for="(itemOffer, index) in offer.item_offers" :key="index" class="offered-item-compact">
                    <ItemIcon 
                      :item-id="itemOffer.item_id" 
                      :item-name="getItemName(itemOffer.item_id)"
                      size="small"
                    />
                    <span>{{ itemOffer.quantity }}x {{ getItemName(itemOffer.item_id) }}</span>
                  </div>
                </div>
                
                <div v-if="offer.message" class="offer-message-compact">
                  <Icon icon="mdi:message-text" />
                  <span>"{{ offer.message }}"</span>
                </div>
                
                <div v-if="offer.quantity_requested" class="quantity-requested-compact">
                  <Icon icon="mdi:package-variant-closed" />
                  <span>Wants {{ offer.quantity_requested }} of {{ selectedListingForOffers?.quantity }}</span>
                </div>
              </div>

              <div v-if="isOwnListing(selectedListingForOffers)" class="offer-actions">
                <div class="action-row">
                  <button @click="acceptOffer(selectedListingForOffers, offer)" class="btn btn-success btn-sm">
                    <Icon icon="mdi:check" />
                    Accept Full Offer
                  </button>
                  <button @click="rejectOffer(offer.id, selectedListingForOffers.id)" class="btn btn-ghost btn-sm">
                    <Icon icon="mdi:close" />
                    Reject
                  </button>
                </div>
                
                <!-- Partial acceptance section for offers requesting specific quantities or when listing has multiple items and accepts partial offers -->
                <div v-if="selectedListingForOffers.accepts_partial_offers && (selectedListingForOffers.quantity > 1 || offer.quantity_requested)" class="partial-accept-section">
                  <div class="partial-accept-header">
                    <Icon icon="mdi:package-variant" />
                    <span>Accept Partial Offer</span>
                  </div>
                  <div class="partial-accept-controls">
                    <div class="quantity-info">
                      <span v-if="offer.quantity_requested">
                        Buyer requested: {{ offer.quantity_requested }} of {{ selectedListingForOffers.quantity }}
                      </span>
                      <span v-else>
                        Available: {{ selectedListingForOffers.quantity }} items
                      </span>
                    </div>
                    <div class="partial-input-group">
                      <input 
                        type="number" 
                        v-model="partialAcceptQuantity[offer.id]"
                        :min="1" 
                        :max="Math.min(offer.quantity_requested || selectedListingForOffers.quantity, selectedListingForOffers.quantity)"
                        :placeholder="`Enter quantity (max: ${Math.min(offer.quantity_requested || selectedListingForOffers.quantity, selectedListingForOffers.quantity)})`"
                        class="partial-quantity-input"
                      >
                      <button 
                        @click="acceptPartialOffer(offer.id, partialAcceptQuantity[offer.id])" 
                        class="btn btn-warning btn-sm"
                        :disabled="!partialAcceptQuantity[offer.id] || partialAcceptQuantity[offer.id] <= 0"
                      >
                        <Icon icon="mdi:check-circle" />
                        Accept {{ partialAcceptQuantity[offer.id] || '?' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="offer-viewer-info">
                <Icon icon="mdi:information" />
                <span class="offer-viewer-note">Only the seller can accept or reject offers</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Make Offer Modal -->
    <div v-if="showOfferModal" class="modal-overlay" @click="showOfferModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Make Offer</h2>
          <button @click="showOfferModal = false" class="close-btn">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="modal-body">
          <div class="listing-summary">
            <div class="listing-summary-header">
              <ItemIcon 
                v-if="selectedListing"
                :item-id="selectedListing.item_id" 
                :item-name="getItemName(selectedListing.item_id)"
                size="large"
              />
              <div class="listing-summary-info">
                <h3>{{ selectedListing?.item_id ? getItemName(selectedListing.item_id) : 'Unknown Item' }}</h3>
                <p>Quantity: {{ selectedListing?.quantity === -1 ? 'Unlimited' : selectedListing?.quantity }}</p>
                <p>
                  {{ selectedListing?.listing_type === 'buying' ? 'Offering Price:' : 'Asking Price:' }} 
                  {{ formatAmount(selectedListing?.asking_price || 0) }} coins
                  {{ selectedListing?.accepts_partial_offers ? ' per item' : '' }}
                </p>
                <p v-if="selectedListing?.accepts_items">✓ Accepts item trades</p>
                <p v-if="selectedListing?.accepts_partial_offers">✓ Accepts partial quantity offers</p>
              </div>
            </div>
          </div>

          <div class="form-group" v-if="selectedListing && (selectedListing.quantity === -1 || (selectedListing.quantity > 1 && selectedListing.accepts_partial_offers))">
            <label>Quantity Requested:</label>
            <div class="quantity-input-group">
              <input 
                type="number" 
                v-model="newOffer.quantityRequested" 
                :min="1" 
                :max="selectedListing.quantity === -1 ? undefined : selectedListing.quantity"
                :placeholder="selectedListing.quantity === -1 ? 'Enter desired quantity' : 'Enter quantity (optional)'"
              >
              <span class="quantity-helper">
                {{ selectedListing.quantity === -1 ? 'Specify how many items you want' : `Leave blank for full quantity (${selectedListing.quantity})` }}
              </span>
            </div>
          </div>

          <div class="offer-type-selector">
            <label>
              <input type="radio" v-model="newOffer.offerType" value="coins">
              Coin Offer
            </label>
            <label v-if="selectedListing?.accepts_items">
              <input type="radio" v-model="newOffer.offerType" value="items">
              Item Offer
            </label>
            <label v-if="selectedListing?.accepts_items">
              <input type="radio" v-model="newOffer.offerType" value="mixed">
              Mixed Offer (Coins + Items)
            </label>
          </div>

          <div v-if="newOffer.offerType === 'coins' || newOffer.offerType === 'mixed'" class="form-group">
            <label>Coin Offer:</label>
            <input type="number" v-model="newOffer.coinOffer" min="0" placeholder="Enter coin amount">
          </div>

          <div v-if="newOffer.offerType === 'items' || newOffer.offerType === 'mixed'" class="item-offers-section">
            <label>Item Offers:</label>
            <div v-for="(itemOffer, index) in newOffer.itemOffers" :key="index" class="item-offer-row">
              <div class="item-offer-selector">
                <ItemSelector
                  v-model="itemOffer.item_id"
                  :items="tradeableItems"
                  placeholder="Select item to offer..."
                />
              </div>
              <input type="number" v-model="itemOffer.quantity" min="1" placeholder="Qty">
              <button @click="removeItemOffer(index)" class="remove-item-btn">
                <Icon icon="mdi:minus" />
              </button>
            </div>
            <button @click="addItemOffer" class="add-item-btn">
              <Icon icon="mdi:plus" /> Add Item
            </button>
          </div>

          <div class="form-group">
            <label>Message (optional):</label>
            <textarea v-model="newOffer.message" placeholder="Add a message to your offer..."></textarea>
          </div>

          <div class="offer-value-summary" v-if="calculateOfferValue() > 0">
            <strong>Total Offer Value: {{ formatAmount(calculateOfferValue()) }} coins</strong>
          </div>

          <div class="modal-actions">
            <button @click="showOfferModal = false" class="cancel-btn">Cancel</button>
            <button @click="submitOffer" class="submit-btn" :disabled="!canSubmitOffer">
              Submit Offer
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Seller Profile Modal -->
    <div v-if="showSellerProfileModal" class="modal-overlay" @click="showSellerProfileModal = false">
      <div class="modal seller-profile-modal" @click.stop>
        <div class="modal-header">
          <h2>Seller Profile</h2>
          <button @click="showSellerProfileModal = false" class="close-btn">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="modal-body" v-if="selectedSellerProfile">
          <div class="seller-profile-content">
            <div class="seller-profile-header">
              <div class="seller-avatar">
                <img 
                  :src="marketplace.getDiscordAvatarUrl(selectedSellerProfile.discord_id, selectedSellerProfile.avatar)" 
                  :alt="`${selectedSellerProfile.username}'s avatar`"
                  @error="(e) => (e.target as HTMLImageElement).src = marketplace.getDiscordAvatarUrl(selectedSellerProfile.discord_id)"
                />
              </div>
              <div class="seller-profile-info">
                <h3>{{ marketplace.formatDiscordUsername(selectedSellerProfile.username, selectedSellerProfile.discriminator) }}</h3>
                <p class="seller-since">Trading since: {{ formatJoinDate(selectedSellerProfile.joined_date) }}</p>
              </div>
            </div>
            
            <div class="seller-stats">
              <h4>Trading Statistics</h4>
              <div class="seller-stats-grid">
                <div class="seller-stat">
                  <Icon icon="mdi:package-variant" />
                  <div>
                    <span class="stat-label">Total Listings</span>
                    <span class="stat-value">{{ selectedSellerProfile.stats.total_listings }}</span>
                  </div>
                </div>
                <div class="seller-stat">
                  <Icon icon="mdi:handshake" />
                  <div>
                    <span class="stat-label">Sales Completed</span>
                    <span class="stat-value">{{ selectedSellerProfile.stats.total_sales }}</span>
                  </div>
                </div>
                <div class="seller-stat">
                  <Icon icon="mdi:chart-line" />
                  <div>
                    <span class="stat-label">Success Rate</span>
                    <span class="stat-value">{{ selectedSellerProfile.stats.success_rate }}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="seller-listings" v-if="selectedSellerProfile.listings.length > 0">
              <h4>Other Listings by {{ selectedSellerProfile.username }}</h4>
              <div class="seller-listings-grid">
                <div 
                  v-for="listing in selectedSellerProfile.listings" 
                  :key="listing.id"
                  class="mini-listing-card"
                  @click="scrollToListing(listing.id.toString())"
                >
                  <ItemIcon 
                    :item-id="listing.item_id" 
                    :item-name="getItemName(listing.item_id)"
                    size="small"
                  />
                  <div class="mini-listing-info">
                    <span class="mini-listing-name">{{ getItemName(listing.item_id) }}</span>
                    <span class="mini-listing-price">{{ formatAmount(listing.asking_price) }} coins</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="seller-recent-trades" v-if="selectedSellerProfile.recent_trades.length > 0">
              <h4>Recent Completed Trades</h4>
              <div class="recent-trades-list">
                <div 
                  v-for="trade in selectedSellerProfile.recent_trades" 
                  :key="`${trade.item_id}-${trade.sold_date}`"
                  class="recent-trade-item"
                >
                  <ItemIcon 
                    :item-id="trade.item_id" 
                    :item-name="getItemName(trade.item_id)"
                    size="small"
                  />
                  <div class="trade-info">
                    <span class="trade-item">{{ getItemName(trade.item_id) }} (x{{ trade.quantity }})</span>
                    <span class="trade-price">{{ formatAmount(trade.asking_price) }} coins</span>
                    <span class="trade-date">{{ formatTradeDate(trade.sold_date) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Feedback Toast Messages -->
    <div class="feedback-container">
      <TransitionGroup name="feedback" tag="div">
        <div 
          v-for="(action, index) in recentActions" 
          :key="`${action}-${index}`"
          :class="['feedback-toast', getFeedbackType(action)]"
        >
          <Icon :icon="getFeedbackIcon(action)" />
          <span>{{ getFeedbackMessage(action) }}</span>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import ItemIcon from '@/components/marketplace/ItemIcon.vue'
import ItemSelector from '@/components/marketplace/ItemSelector.vue'
import itemDefs from '@/assets/marketplace/itemdefs.json'
import { useMarketplace, type MarketplaceListing, type ItemOffer } from '@/composables/useMarketplace'
import { useAuthStore } from '@/stores/auth'

// Types
interface Item {
  _id: number
  name: string
  description: string
  cost: number
  isTradeable: boolean
}

interface NewListing {
  itemId: number | string
  quantity: number
  isInfinite: boolean
  askingPrice: number
  acceptsItems: boolean
  acceptsPartialOffers: boolean
  listingType: 'selling' | 'buying'
  notes: string
}

interface NewOffer {
  offerType: 'coins' | 'items' | 'mixed'
  coinOffer: number
  quantityRequested?: number
  itemOffers: ItemOffer[]
  message: string
}

// Composables
const marketplace = useMarketplace()
const authStore = useAuthStore()
const route = useRoute()

// Reactive data
const showCreateListing = ref(false)
const showEditListing = ref(false)
const editingListing = ref<MarketplaceListing | null>(null)
const showOfferModal = ref(false)
const selectedListing = ref<MarketplaceListing | null>(null)
const searchQuery = ref('')
const listingTypeFilter = ref<'all' | 'selling' | 'buying'>('all')

// Sorting state
const sortColumn = ref<string | null>(null)
const sortDirection = ref<'asc' | 'desc'>('asc')

// New UX features
const showSellerProfileModal = ref(false)
const selectedSellerProfile = ref<any | null>(null)
const showOffersModal = ref(false)
const selectedListingForOffers = ref<MarketplaceListing | null>(null)
const showMarketStats = ref(false)
const recentActions = ref<string[]>([]) // For feedback messages

// Offers data
const listingOffers = ref<{ [listingId: string]: any[] }>({})
const partialAcceptQuantity = ref<{ [offerId: string]: number }>({})

// Form data
const newListing = ref<NewListing>({
  itemId: '',
  quantity: 1,
  isInfinite: false,
  askingPrice: 0,
  acceptsItems: false,
  acceptsPartialOffers: false,
  listingType: 'selling',
  notes: ''
})

const newOffer = ref<NewOffer>({
  offerType: 'coins',
  coinOffer: 0,
  quantityRequested: undefined,
  itemOffers: [],
  message: ''
})

// Computed properties
const tradeableItems = computed(() => {
  return (itemDefs as Item[]).filter(item => item.isTradeable)
})

const totalOffers = computed(() => {
  return marketplace.listings.value.reduce((total, listing) => {
    // Use the offer_count from the listing if available, otherwise fallback to 0
    const offerCount = typeof listing.offer_count === 'number' ? listing.offer_count : 0
    return total + offerCount
  }, 0)
})

const canCreateListing = computed(() => {
  return newListing.value.itemId && 
         (newListing.value.isInfinite || newListing.value.quantity > 0) && 
         newListing.value.askingPrice > 0 &&
         authStore.isAuthenticated
})

const canUpdateListing = computed(() => {
  return editingListing.value &&
         (editingListing.value.quantity > 0 || editingListing.value.quantity === -1) && 
         editingListing.value.asking_price > 0 &&
         authStore.isAuthenticated
})

const canSubmitOffer = computed(() => {
  if (!authStore.isAuthenticated) return false
  
  const hasValidCoinOffer = newOffer.value.offerType === 'coins' && newOffer.value.coinOffer > 0
  const hasValidItemOffer = (newOffer.value.offerType === 'items' || newOffer.value.offerType === 'mixed') && 
                           newOffer.value.itemOffers.some(offer => offer.item_id && offer.quantity > 0)
  const hasValidMixedOffer = newOffer.value.offerType === 'mixed' && 
                            (newOffer.value.coinOffer > 0 || newOffer.value.itemOffers.some(offer => offer.item_id && offer.quantity > 0))
  
  return hasValidCoinOffer || hasValidItemOffer || hasValidMixedOffer
})

const filteredListings = computed(() => {
  let filtered = [...marketplace.listings.value]
  
  // Search filter - search by item name only
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(listing => {
      const itemName = getItemName(listing.item_id).toLowerCase()
      return itemName.includes(query)
    })
  }
  
  // Listing type filter
  if (listingTypeFilter.value !== 'all') {
    filtered = filtered.filter(listing => listing.listing_type === listingTypeFilter.value)
  }
  
  // Apply column sorting
  if (sortColumn.value) {
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortColumn.value) {
        case 'quantity':
          aValue = a.quantity === -1 ? Infinity : a.quantity
          bValue = b.quantity === -1 ? Infinity : b.quantity
          break
        case 'price':
          aValue = a.asking_price
          bValue = b.asking_price
          break
        case 'offers':
          aValue = getOfferCount(a.id)
          bValue = getOfferCount(b.id)
          break
        default:
          return 0
      }
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return sortDirection.value === 'asc' ? comparison : -comparison
    })
  } else {
    // Default sort by newest
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  
  return filtered
})

// Helper function to check if a listing has infinite quantity
const isInfiniteListing = (listing: MarketplaceListing): boolean => {
  return listing.quantity === -1
}

// Sorting functions
const sortByColumn = (column: string) => {
  if (sortColumn.value === column) {
    // Toggle direction if clicking the same column
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Set new column and default to ascending
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

// Methods
const getItem = (itemId: number): Item | undefined => {
  return (itemDefs as Item[]).find(item => item._id === itemId)
}

const getItemName = (itemId: number): string => {
  const item = getItem(itemId)
  if (!item) return 'Unknown Item'
  
  // Capitalize each word in the item name
  return item.name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const getItemDescription = (itemId: number): string => {
  return getItem(itemId)?.description || 'No description available'
}

// Utility function to format numbers with k/m suffixes
const formatAmount = (amount: number): string => {
  if (amount >= 1000000) {
    const formatted = (amount / 1000000).toFixed(2).replace(/\.?0+$/, '')
    return `${formatted}m`
  }
  if (amount >= 1000) {
    const formatted = (amount / 1000).toFixed(1).replace(/\.?0+$/, '')
    return `${formatted}k`
  }
  return amount.toString()
}

const updateSelectedItem = (item: Item | null) => {
  if (item) {
    newListing.value.askingPrice = item.cost
  }
}

const toggleInfiniteQuantity = () => {
  newListing.value.isInfinite = true
  // Force accept partial offers to be enabled for infinite quantities
  newListing.value.acceptsPartialOffers = true
}

const createListing = async () => {
  if (!canCreateListing.value) return
  
  try {
    await marketplace.createListing({
      itemId: Number(newListing.value.itemId),
      quantity: newListing.value.isInfinite ? -1 : newListing.value.quantity, // Use -1 to indicate infinite
      askingPrice: newListing.value.askingPrice,
      acceptsItems: newListing.value.acceptsItems,
      acceptsPartialOffers: newListing.value.acceptsPartialOffers,
      listingType: newListing.value.listingType,
      notes: newListing.value.notes
    })
    
    // Reset form
    newListing.value = {
      itemId: '',
      quantity: 1,
      isInfinite: false,
      askingPrice: 0,
      acceptsItems: false,
      acceptsPartialOffers: false,
      listingType: 'selling',
      notes: ''
    }
    
    showCreateListing.value = false
    showFeedback('Listing created successfully!', 'success')
  } catch (error) {
    showFeedback('Failed to create listing', 'error')
  }
}

const editListing = (listing: MarketplaceListing) => {
  if (!isOwnListing(listing)) {
    showFeedback('You can only edit your own listings', 'error')
    return
  }
  
  console.log('Original listing accepts_partial_offers:', listing.accepts_partial_offers)
  console.log('Original listing accepts_items:', listing.accepts_items)
  
  // Create a deep copy of the listing for editing
  // Ensure all boolean fields are always defined as booleans, never undefined
  editingListing.value = {
    id: listing.id,
    user_id: listing.user_id,
    item_id: listing.item_id,
    quantity: listing.quantity,
    asking_price: listing.asking_price,
    accepts_items: Boolean(listing.accepts_items),
    accepts_partial_offers: Boolean(listing.accepts_partial_offers),
    notes: listing.notes || '',
    listing_type: listing.listing_type,
    status: listing.status,
    created_at: listing.created_at,
    updated_at: listing.updated_at,
    seller_name: listing.seller_name,
    seller_discord_id: listing.seller_discord_id,
    seller_discriminator: listing.seller_discriminator,
    seller_avatar: listing.seller_avatar,
    seller_joined_date: listing.seller_joined_date,
    offer_count: listing.offer_count
  }
  
  console.log('Editing listing accepts_partial_offers:', editingListing.value.accepts_partial_offers)
  console.log('Editing listing accepts_items:', editingListing.value.accepts_items)
  
  showEditListing.value = true
}

const updateListing = async () => {
  if (!canUpdateListing.value || !editingListing.value) return
  
  try {
    await marketplace.updateListing(editingListing.value.id, {
      quantity: editingListing.value.quantity,
      asking_price: editingListing.value.asking_price,
      accepts_items: editingListing.value.accepts_items,
      accepts_partial_offers: editingListing.value.accepts_partial_offers ?? false,
      notes: editingListing.value.notes
    })
    
    showEditListing.value = false
    editingListing.value = null
    showFeedback('Listing updated successfully!', 'success')
  } catch (error) {
    showFeedback('Failed to update listing', 'error')
  }
}

const isOwnListing = (listing: MarketplaceListing): boolean => {
  return marketplace.isOwnListing(listing)
}

const showMakeOffer = (listing: MarketplaceListing) => {
  if (!authStore.isAuthenticated) {
    showFeedback('Please log in to make offers', 'error')
    return
  }
  
  selectedListing.value = listing
  newOffer.value = {
    offerType: 'coins',
    coinOffer: 0,
    quantityRequested: undefined,
    itemOffers: [],
    message: ''
  }
  showOfferModal.value = true
}

const addItemOffer = () => {
  newOffer.value.itemOffers.push({ item_id: 0, quantity: 1 })
}

const removeItemOffer = (index: number) => {
  newOffer.value.itemOffers.splice(index, 1)
}

const calculateOfferValue = (): number => {
  let total = newOffer.value.coinOffer || 0
  
  newOffer.value.itemOffers.forEach(itemOffer => {
    const item = getItem(itemOffer.item_id)
    if (item) {
      total += item.cost * itemOffer.quantity
    }
  })
  
  return total
}

const submitOffer = async () => {
  if (!canSubmitOffer.value || !selectedListing.value) return
  
  try {
    await marketplace.createOffer(selectedListing.value.id, {
      coinOffer: newOffer.value.coinOffer || 0,
      quantityRequested: newOffer.value.quantityRequested,
      itemOffers: newOffer.value.itemOffers.filter(offer => offer.item_id && offer.quantity > 0).map(offer => ({
        item_id: offer.item_id,
        quantity: offer.quantity
      })),
      message: newOffer.value.message
    })
    
    // Refresh listings to update offer counts
    await marketplace.fetchListings()
    
    showOfferModal.value = false
    selectedListing.value = null
    showFeedback('Offer submitted successfully!', 'success')
  } catch (error) {
    showFeedback('Failed to submit offer', 'error')
  }
}

const viewOffers = async (listing: MarketplaceListing) => {
  try {
    const offers = await marketplace.fetchOffersForListing(listing.id)
    listingOffers.value[listing.id] = offers
    
    selectedListingForOffers.value = listing
    showOffersModal.value = true
  } catch (error) {
    showFeedback('Failed to load offers', 'error')
  }
}

const getOffersForListing = (listingId: string): any[] => {
  return listingOffers.value[listingId] || []
}

const getOfferCount = (listingId: string): number => {
  // First check if we have a listing with the offer_count from backend
  const listing = marketplace.listings.value.find(l => l.id === listingId)
  if (listing && typeof listing.offer_count === 'number') {
    return listing.offer_count
  }
  // Fallback to loaded offers count
  return getOffersForListing(listingId).length
}

const acceptOffer = async (_listing: MarketplaceListing, offer: any) => {
  try {
    await marketplace.acceptOffer(offer.id)
    
    // Close the offers modal
    showOffersModal.value = false
    selectedListingForOffers.value = null
    
    showFeedback(`Offer accepted! Trade is now pending verification from both parties.`, 'success')
    
    // Show additional guidance
    setTimeout(() => {
      showFeedback('Please confirm the trade once you have completed the exchange.', 'info')
    }, 2000)
  } catch (error) {
    showFeedback('Failed to accept offer', 'error')
  }
}

const acceptPartialOffer = async (offerId: string, quantity: number) => {
  if (!quantity || quantity <= 0) {
    showFeedback('Please enter a valid quantity', 'error')
    return
  }
  
  try {
    const result = await marketplace.acceptPartialOffer(offerId, quantity)
    
    // Clear the partial quantity input
    delete partialAcceptQuantity.value[offerId]
    
    // Close the offers modal
    showOffersModal.value = false
    selectedListingForOffers.value = null
    
    const message = result.remainingQuantity > 0 
      ? `Partial offer accepted for ${quantity} items! ${result.remainingQuantity} remaining in listing.`
      : `Offer accepted for ${quantity} items! Listing is now complete.`
    
    showFeedback(message, 'success')
    
    // Show additional guidance
    setTimeout(() => {
      showFeedback('Please confirm the trade once you have completed the exchange.', 'info')
    }, 2000)
  } catch (error) {
    showFeedback('Failed to accept partial offer', 'error')
  }
}

const confirmTrade = async (tradeConfirmationId: string) => {
  try {
    const result = await marketplace.confirmTrade(tradeConfirmationId)
    
    if (result.status === 'completed') {
      showFeedback('Trade completed successfully! Both parties have confirmed.', 'success')
    } else {
      showFeedback(result.message, 'info')
    }
  } catch (error) {
    showFeedback('Failed to confirm trade', 'error')
  }
}

const cancelTrade = async (tradeConfirmationId: string) => {
  if (!confirm('Are you sure you want to cancel this trade? The listing will become active again.')) {
    return
  }
  
  try {
    await marketplace.cancelTrade(tradeConfirmationId)
    showFeedback('Trade cancelled. Listing is now active again.', 'info')
  } catch (error) {
    showFeedback('Failed to cancel trade', 'error')
  }
}

const rejectOffer = async (offerId: string, listingId: string) => {
  try {
    await marketplace.rejectOffer(offerId)
    
    // Refresh offers for this listing
    const offers = await marketplace.fetchOffersForListing(listingId)
    listingOffers.value[listingId] = offers
    
    // Refresh listings to update offer counts
    await marketplace.fetchListings()
    
    showFeedback('Offer rejected', 'info')
  } catch (error) {
    showFeedback('Failed to reject offer', 'error')
  }
}

const removeListing = async (listingId: string) => {
  try {
    await marketplace.deleteListing(listingId)
    
    showFeedback('Listing removed successfully', 'success')
  } catch (error) {
    showFeedback('Failed to remove listing', 'error')
  }
}

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getRelativeTime = (date: string): string => {
  const now = new Date().getTime()
  const time = new Date(date).getTime()
  const diffInMinutes = Math.floor((now - time) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d ago`
  
  return formatDate(date)
}

const isRecentListing = (listing: MarketplaceListing): boolean => {
  const now = new Date().getTime()
  const listingTime = new Date(listing.created_at).getTime()
  const hoursDiff = (now - listingTime) / (1000 * 60 * 60)
  return hoursDiff <= 24 // Consider listings from last 24 hours as "recent"
}

// Seller profile modal
const showSellerProfile = async (sellerId: string) => {
  try {
    const profile = await marketplace.fetchSellerProfile(sellerId)
    if (profile) {
      selectedSellerProfile.value = profile
      showSellerProfileModal.value = true
    } else {
      showFeedback('Failed to load seller profile', 'error')
    }
  } catch (error) {
    console.error('Error loading seller profile:', error)
    showFeedback('Failed to load seller profile', 'error')
  }
}

// Feedback system
const showFeedback = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  recentActions.value.unshift(`${type}:${message}`)
  
  // Remove after 3 seconds
  setTimeout(() => {
    recentActions.value = recentActions.value.filter(action => action !== `${type}:${message}`)
  }, 3000)
  
  // Keep only last 3 messages
  if (recentActions.value.length > 3) {
    recentActions.value = recentActions.value.slice(0, 3)
  }
}

const getFeedbackType = (action: string): string => {
  return action.split(':')[0]
}

const getFeedbackMessage = (action: string): string => {
  return action.split(':')[1]
}

const getFeedbackIcon = (action: string): string => {
  const type = action.split(':')[0]
  switch (type) {
    case 'success': return 'mdi:check-circle'
    case 'error': return 'mdi:alert-circle'
    case 'info': return 'mdi:information'
    default: return 'mdi:information'
  }
}

// Market statistics for item details
const getMarketStats = (itemId: number) => {
  // Only consider selling listings for market statistics
  const itemListings = marketplace.listings.value.filter(l => l.item_id === itemId && l.listing_type === 'selling')
  
  // Calculate average price per item and collect per-item prices for range
  let totalPerItemPrices = 0
  let listingCount = 0
  const perItemPrices: number[] = []
  
  itemListings.forEach(listing => {
    let pricePerItem = 0
    
    if (listing.quantity === -1 || listing.accepts_partial_offers) {
      // For infinite listings or partial offers, asking_price is already per item
      pricePerItem = listing.asking_price
    } else {
      // For non-partial listings, asking_price is total price, so calculate per item
      pricePerItem = listing.asking_price / listing.quantity
    }
    
    totalPerItemPrices += pricePerItem
    perItemPrices.push(pricePerItem)
    listingCount++
  })
  
  const avgPrice = listingCount > 0 ? Math.round(totalPerItemPrices / listingCount) : 0
  
  return {
    activeListings: itemListings.length,
    avgPrice: avgPrice,
    priceRange: perItemPrices.length ? `${formatAmount(Math.min(...perItemPrices))} - ${formatAmount(Math.max(...perItemPrices))}` : 'N/A'
  }
}

// Date formatting functions
const formatJoinDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const formatTradeDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Initialize
onMounted(async () => {
  await marketplace.fetchListings()
  
  // Fetch pending trades if user is authenticated
  if (authStore.isAuthenticated) {
    await marketplace.fetchPendingTrades()
  }
  
  // Check for listing query parameter and scroll to it
  const listingId = route.query.listing as string
  if (listingId) {
    await nextTick() // Wait for DOM to update
    scrollToListing(listingId)
  }
})

// Function to scroll to and highlight a specific listing
const scrollToListing = (listingId: string) => {
  const element = document.querySelector(`[data-listing-id='${listingId}']`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Add a temporary highlight effect
    element.classList.add('highlighted-listing')
    setTimeout(() => {
      element.classList.remove('highlighted-listing')
    }, 3000)
  }
}
</script>
<style scoped>
    @import url('@/assets/marketplace/marketplace.css');
</style>