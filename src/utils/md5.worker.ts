
import SparkMD5 from 'spark-md5';

let spark: SparkMD5.ArrayBuffer | null = null;

self.onmessage = function (e) {
  const { type, chunk, chunks, currentChunk } = e.data;
  
  if (type === 'init') {
    spark = new SparkMD5.ArrayBuffer();
  } else if (type === 'chunk' && spark) {
    spark.append(chunk);
    
    self.postMessage({
      type: 'progress',
      progress: currentChunk / chunks
    });
  } else if (type === 'finish' && spark) {
    self.postMessage({
      type: 'result',
      md5: spark.end()
    });
    spark = null;
  }
};

