<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { RouterLink, RouterView } from 'vue-router'
import UserMenu from '@/components/UserMenu.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <header>
    <div id="logo">
      <img width="43px" src="@/assets/logo.png" />
    </div>
    <nav>
      <RouterLink to="/" class="navItem">Home</RouterLink>
      <RouterLink to="/map" class="navItem">Map</RouterLink>
      <RouterLink to="/marketplace" class="navItem">Marketplace</RouterLink>
      <RouterLink 
        v-if="authStore.isAdmin" 
        to="/admin" 
        class="navItem admin-link"
      >
        Admin
      </RouterLink>
    </nav>
    <UserMenu />
  </header>
  
  <main>
    <RouterView />
  </main>
  
  <div id="copyright">
    <span>© 2025 Highlite. All rights reserved.</span>
    <span>Made with ❤️ by the Highlite Team</span>
  </div>

  <div class="joinUs">
    <a href="https://discord.gg/highspell" target="_blank">
      <button>Join us on <Icon icon="simple-icons:discord" /></button>
    </a>
  </div>
</template>

<style scoped>
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: var(--theme-background);
  border-bottom: 1px solid var(--theme-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

main {
  flex: 1;
  overflow-x: hidden;
}

/* Navbar Dropdown Element */
nav {
  display: flex;
  gap: 1rem;
}
nav .navItem {
  color: var(--theme-text-primary);
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: all 0.3s ease;
}
nav .navItem:hover {
  background-color: var(--theme-background-mute);
  color: var(--theme-accent);
}
nav .router-link-active {
  background-color: var(--theme-accent);
  color: var(--theme-text-dark);
}

nav .admin-link {
  background-color: var(--theme-accent-muted);
  color: var(--theme-accent);
  font-weight: 600;
  border: 1px solid var(--theme-accent);
}

nav .admin-link:hover {
  background-color: var(--theme-accent);
  color: var(--theme-text-dark);
}

nav .admin-link.router-link-active {
  background-color: var(--theme-accent);
  color: var(--theme-text-dark);
  box-shadow: 0 0 10px var(--theme-accent-muted);
}

#logo {
  display: flex;
  align-items: center;
}

#logo h2 {
  margin-left: 0.5rem;
  color: var(--theme-text-primary);

  /* Highlight Effect using theme accent color */
  text-shadow:
    0 0 5px var(--theme-accent-muted),
    0 0 10px var(--theme-accent-muted),
    0 0 15px var(--theme-accent-muted),
    0 0 20px var(--theme-accent-muted);
  font-size: 1.5rem;
  font-weight: bold;
  text-transform: uppercase;
}

/* Responsive navigation */
@media (max-width: 768px) {
  header {
    padding: 0.5rem;
    flex-wrap: wrap;
  }
  
  nav {
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  nav .navItem {
    padding: 0.4rem 0.8rem;
    font-size: 14px;
  }
  
  #logo img {
    width: 35px;
  }
}

@media (max-width: 480px) {
  header {
    flex-direction: column;
    padding: 0.5rem;
    gap: 0.5rem;
  }
  
  nav {
    justify-content: center;
    width: 100%;
  }
  
  nav .navItem {
    padding: 0.3rem 0.6rem;
    font-size: 13px;
  }
}
</style>
