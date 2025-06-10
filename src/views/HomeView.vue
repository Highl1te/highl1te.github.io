<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { onMounted } from 'vue';


onMounted(() => {
  const contributeButton = document.getElementById('contribute');
  const downloadButton = document.getElementById('download');

  const releaseAssets = {
    windows: '',
    linux: '',
    mac: '',
    unkown: ''
  };

  // Obtain Release Information from Github API
  fetch('https://api.github.com/repos/HighL1te/HighLiteDesktop/releases/latest')
    .then(response => response.json())
    .then(data => {
      const latestRelease = data.tag_name;

      // Loop through assets and find the latest release for each OS
      data.assets.forEach(asset => {
        if (asset.name.endsWith('.exe')) {
          releaseAssets.windows = asset.browser_download_url;
        } else if (asset.name.endsWith('.AppImage')) {
          releaseAssets.linux = asset.browser_download_url;
        } else if (asset.name.endsWith('.dmg')) {
          releaseAssets.mac = asset.browser_download_url;
        }
      });

      releaseAssets.unkown = "https://github.com/HighL1te/HighLiteDesktop/releases/latest";
      const statsElement = document.getElementById('aboutStats');


      if (downloadButton) {
        // Based off userAgent OS update Download button
        const userOS = window.navigator.platform.toLowerCase();
        if (userOS.includes('win')) {
          downloadButton.innerHTML = `<i class="fa-brands fa-windows"></i> Download`;
        } else if (userOS.includes('linux')) {
          downloadButton.innerHTML = `<i class="fa-brands fa-linux"></i> Download`;
        } else if (userOS.includes('mac')) {
          downloadButton.innerHTML = `<i class="fa-brands fa-apple"></i> Download`;
        } else {
          downloadButton.innerHTML = `Download`;
        }
      }
    })
    .catch(error => console.error('Error fetching release info:', error));

    fetch('https://api.github.com/repos/HighL1te/HighLiteDesktop/releases')
    .then(response => response.json())
    .then(data => {
      // For each release, get the number of downloads for each .exe, .AppImage, and .dmg
      let totalDownloads = 0;
      data.forEach(release => {
        release.assets.forEach(asset => {
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
      const userOS = window.navigator.platform.toLowerCase();
      if (userOS.includes('win')) {
        window.open(releaseAssets.windows);
      } else if (userOS.includes('linux')) {
        window.open(releaseAssets.linux);
      } else if (userOS.includes('mac')) {
        window.open(releaseAssets.mac);
      } else {
        window.open(releaseAssets.unkown);
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
        <div><button id="contribute"><font-awesome-icon :icon="faGithub" /> Contribute </button> <button id="download">Download</button></div>
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
  height: calc(100vh - 75px);
  justify-content: center;
}

#aboutContent {
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  position: absolute;
  padding: 2rem;
  border-radius: 10px;
  width: 80%;
  max-width: 800px;

  top: 50%;
  transform: translate(0, -50%);
}

#aboutContent h1 {
  background: #F9F449;
  background: linear-gradient(90deg, #fede4a 0%, rgba(255, 255, 255, 1) 60%);
  font-weight: bold;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 4rem;
}

#aboutContent p {
  font-size: 1.5rem;
  margin: 1rem 0;
}

#aboutContent #contribute {
  /* Yellow outline */
  border: 2px solid #ffffff;
  background-color: transparent;
  color: #ffffff;
  padding: 8px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s ease;
  margin-right: 10px;
}

#aboutContent #contribute:hover {
  background-color: #ffffff;
  color: black;
}

#aboutContent #download {
  border: 2px solid #F9F449;
  background-color: transparent;
  color: #ffffff;
  padding: 8px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s ease;
  margin-right: 10px;
}
#aboutContent #download:hover {
  background-color: #F9F449;
  color: black;
}

#aboutContent #aboutStats {
  margin-top: 1rem;
  font-size: 0.8rem;
  color: #ffffff;
}


</style>
