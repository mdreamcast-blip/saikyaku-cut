const path=require("node:path"),os=require("node:os"),fs=require("node:fs");
const {transcribe}=require("@remotion/install-whisper-cpp");
const base=path.join(os.homedir(),"Library/Application Support/ReelCaption");
(async()=>{
  const json=await transcribe({inputPath:path.join(os.tmpdir(),"rc-test.wav"),whisperPath:path.join(base,"whisper.cpp"),whisperCppVersion:"1.7.2",model:"large-v3-turbo",modelFolder:path.join(base,"whisper-models"),language:"ja",tokenLevelTimestamps:true,printOutput:false});
  fs.writeFileSync(path.join(base,"last-raw.json"),JSON.stringify(json,null,1));
  for(const seg of json.transcription.slice(0,2)){
    console.log("SEG",seg.offsets,JSON.stringify(seg.text));
    for(const t of seg.tokens) console.log(" ",t.offsets.from,t.offsets.to,JSON.stringify(t.text),t.p.toFixed(2),"dtw",t.t_dtw);
  }
})();
