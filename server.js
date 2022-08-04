// read the folders in /var/www
import { promises as pfs } from 'fs'
import fs from 'fs';
import axios from 'axios';

const Axios = axios.create();

Axios.interceptors.response.use(function (response) {
  response.config.metadata.endTime = new Date()
  response.duration = (response.config.metadata.endTime - response.config.metadata.startTime) / 1000
  return response;
}, function (error) {
  return Promise.reject(error);
});

Axios.interceptors.request.use(
  function (config) {
    config.metadata = { startTime: new Date() }
    return config;
}, function (error) {
    return Promise.reject(error);
});

const defaultFileContent = {
  ping: [],
  failures: []
}

const ping = async (host, acceptedStatus = [200, 201]) => {
  return new Promise((resolve) => {
    Axios.get(host)
      .then(res => {
        if (acceptedStatus.includes(res.status)) resolve({ timestamp: res.config.metadata.startTime, value: res.duration });
        else resolve({ timestamp: res.config.metadata.startTime, value: null });
      })
      .catch((err) => resolve({ timestamp: err.config.metadata.startTime, value: null }));
  })
}

const getDirectories = async source =>
(await pfs.readdir(source, { withFileTypes: true }))
  .filter(dirent => 
    dirent.isDirectory() && 
    dirent.name.includes('faridevnz.me') && 
    dirent.name !== 'status.faridevnz.me'
  )
  .map(dirent => dirent.name)

const savePingResult = (host, { timestamp, value }) => {
  // if file does not exists, create it ( host.json )
  if (!fs.existsSync(`./ping-results/${host}.json`)) {
    fs.writeFileSync(`./ping-results/${host}.json`, JSON.stringify(defaultFileContent), 'utf-8')
  }
  // append the result at the ping array
  const content = JSON.parse(fs.readFileSync(`./ping-results/${host}.json`, 'utf-8'))
  content.ping.push({ timestamp, value });
  // save failures timestamp
  if (value === null) {
    content.failures.push(timestamp)
  }
  // trim the array
  if (content.ping.length > 20) {
    content.ping = content.ping.slice(-20);
  }
  // save the new data
  fs.writeFileSync(`./ping-results/${host}.json`, JSON.stringify(content), 'utf-8')
}


// PING THE ACTIVE SITES

setInterval(async () => {
  const direcories = await getDirectories('/var/www/');
  direcories.forEach((dir) => {
    // frontend check
    ping(`https://${dir}`).then(({ timestamp, value }) => {
      // console.log(new Date().toLocaleString('it-IT', { timeZone: "Europe/Rome" }))
      // save the ping status
      savePingResult(dir, { timestamp, value });
    });
  })
}, 5000);

