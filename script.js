const worker = new Worker("./worker.js", { type: "module"});
const output = document.getElementById('output');
worker.onmessage = (message)=>{
  output.innerHTML = JSON.stringify(JSON.parse(message.data), null, 2) + '<br/><br/><br/><br/>';
}

const run = document.getElementById('run');
run.addEventListener('click', ()=>{
  worker.postMessage(['run'])
});