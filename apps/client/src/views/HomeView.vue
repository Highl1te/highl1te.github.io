<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { onMounted } from 'vue';


onMounted(() => {
  const contributeButton = document.getElementById('contribute');
  const downloadButton = document.getElementById('download');

  const releaseAssets = {
    windows: '',
    linuxX64: '',
    linuxArm64: '',
    mac: '',
    unknown: ''
  };

  // Obtain Release Information from Github API
  fetch('https://api.github.com/repos/HighL1te/HighLiteDesktop/releases/latest')
    .then(response => response.json())
    .then(data => {
      // Loop through assets and find the latest release for each OS
      data.assets.forEach((asset: any) => {
        if (asset.name.endsWith('.exe')) {
          releaseAssets.windows = asset.browser_download_url;
        } else if (asset.name.includes('arm64') && asset.name.endsWith('.AppImage')) {
          releaseAssets.linuxArm64 = asset.browser_download_url;
        } else if (asset.name.endsWith('.AppImage') && !asset.name.includes('arm64')) {
          releaseAssets.linuxX64 = asset.browser_download_url;
        } else if (asset.name.endsWith('.dmg')) {
          releaseAssets.mac = asset.browser_download_url;
        }
      });

      releaseAssets.unknown = "https://github.com/HighL1te/HighLiteDesktop/releases/latest";
    })
    .catch(error => console.error('Error fetching release info:', error));

    fetch('https://api.github.com/repos/HighL1te/HighLiteDesktop/releases')
    .then(response => response.json())
    .then(data => {
      // For each release, get the number of downloads for each .exe, .AppImage, and .dmg
      let totalDownloads = 0;
      data.forEach((release: any) => {
        release.assets.forEach((asset: any) => {
          if (asset.name.endsWith('.exe') || asset.name.endsWith('.AppImage') || asset.name.endsWith('.dmg')) {
            totalDownloads += asset.download_count;
          }
        });
      });

      const statsElement = document.getElementById('aboutStats');
      if (statsElement) {
        statsElement.innerHTML = `
          <span>Latest Release: ${data[0].tag_name}</span>
          <span> | </span>
          <span>Downloads: ${totalDownloads}</span>
        `;
      }
    })


  if (contributeButton) {
    contributeButton.addEventListener('click', () => {
      window.open('https://github.com/HighL1te/HighLiteDesktop', '_blank');
    });
  }
  if (downloadButton) {
    downloadButton.addEventListener('click', () => {
      // Get user agent and platform information
      const userAgent = window.navigator.userAgent.toLowerCase();
      const platform = window.navigator.platform.toLowerCase();
      
      // Detect OS and architecture
      if (platform.includes('win') || userAgent.includes('windows')) {
        // Windows
        window.open(releaseAssets.windows || releaseAssets.unknown);
      } else if (platform.includes('mac') || userAgent.includes('mac')) {
        // macOS
        window.open(releaseAssets.mac || releaseAssets.unknown);
      } else if (platform.includes('linux') || userAgent.includes('linux')) {
        // Linux - detect architecture
        const isArm64 = userAgent.includes('aarch64') || 
                       userAgent.includes('arm64') || 
                       platform.includes('arm');
        
        if (isArm64) {
          window.open(releaseAssets.linuxArm64 || releaseAssets.linuxX64 || releaseAssets.unknown);
        } else {
          window.open(releaseAssets.linuxX64 || releaseAssets.linuxArm64 || releaseAssets.unknown);
        }
      } else {
        // Unknown OS - redirect to releases page
        window.open(releaseAssets.unknown);
      }
    })
  };
});

</script>

<template>
  <main>
    <video src="@/assets/contentBackground.mp4" autoplay loop muted playsinline id="backgroundVideo">
    </video>
    <div id="about">
      <div id="aboutContent">
        <h1>HighLite</h1>
        <p>An open-source RuneLite-esque standalone client for High Spell</p>
        <div class="button-container">
          <button id="contribute"><Icon icon="simple-icons:github" /> Contribute </button>
          <button id="download"><Icon icon="ic:baseline-file-download" /> Download</button>
        </div>
        <div id="aboutStats">
          <span>Latest Release: -</span>
          <span> | </span>
          <span>Downloads: -</span>
        </div>
      </div>
  </div>
  </main>
</template>

<style scoped>
/* Background Image */
#about::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('@/assets/homepageBackground.png');
  background-size: cover;
  background-position: center;
  z-index: -2; /* Behind the content */
  opacity: 0.25; /* Adjust opacity */
  filter: blur(5px); /* Optional: add a blur effect */
}

#backgroundVideo {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1; /* Behind the content */
  opacity: 1; /* Adjust opacity */
  filter: blur(10px); /* Optional: add a blur effect */
}

#about {
  display: flex;
  min-height: calc(100vh - 120px);
  justify-content: center;
  align-items: center;
  padding: 2rem 1rem;
  position: relative;
}

#aboutContent {
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: var(--theme-text-primary);
  background-color: rgba(26, 26, 26, 0.9);
  border: 1px solid var(--theme-border);
  padding: 2rem;
  border-radius: 10px;
  width: 90%;
  max-width: 800px;
  margin: auto;
  box-sizing: border-box;
}

#aboutContent h1 {
  background: var(--theme-accent);
  background: linear-gradient(90deg, var(--theme-accent) 0%, var(--theme-accent-light) 60%);
  font-weight: bold;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 4rem;
}

#aboutContent p {
  font-size: 1.5rem;
  margin: 1rem 0;
  color: var(--theme-text-secondary);
}

#aboutContent #contribute {
  border: 2px solid var(--theme-text-primary);
  background-color: transparent;
  color: var(--theme-text-primary);
  padding: 8px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

#aboutContent #contribute:hover {
  background-color: var(--theme-text-primary);
  color: var(--theme-text-dark);
}

#aboutContent #download {
  border: 2px solid var(--theme-accent);
  background-color: transparent;
  color: var(--theme-text-primary);
  padding: 8px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
#aboutContent #download:hover {
  background-color: var(--theme-accent);
  color: var(--theme-text-dark);
}

#aboutContent #aboutStats {
  margin-top: 1rem;
  font-size: 0.8rem;
  color: var(--theme-text-secondary);
}

#aboutContent #contribute svg,
#aboutContent #download svg,
#aboutContent #contribute iconify-icon,
#aboutContent #download iconify-icon {
  vertical-align: middle;
}

.button-container {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* Responsive design */
@media (max-width: 768px) {
  #about {
    min-height: calc(100vh - 100px);
    padding: 1rem 0.5rem;
  }
  
  #aboutContent {
    width: 95%;
    padding: 1.5rem;
  }
  
  #aboutContent h1 {
    font-size: 2.5rem;
  }
  
  #aboutContent p {
    font-size: 1.2rem;
  }
  
  #aboutContent #contribute,
  #aboutContent #download {
    padding: 6px 16px;
    font-size: 14px;
    margin-right: 8px;
    margin-bottom: 8px;
  }
}

@media (max-width: 480px) {
  #aboutContent {
    width: 98%;
    padding: 1rem;
  }
  
  #aboutContent h1 {
    font-size: 2rem;
  }
  
  #aboutContent p {
    font-size: 1rem;
  }
  
  #aboutContent #contribute,
  #aboutContent #download {
    display: block;
    width: 100%;
    margin-right: 0;
    margin-bottom: 10px;
  }
}
</style>
