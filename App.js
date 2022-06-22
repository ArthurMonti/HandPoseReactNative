import React, { useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Platform, Image, Button } from 'react-native';
import { Camera, Constants } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import { cameraWithTensors, asyncStorageIO } from '@tensorflow/tfjs-react-native';
import ClassMapping from "./ClassMapping"
import mode from './model'
import axiosF from './axiosFunction'
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-react-native';
import '@tensorflow/tfjs-backend-webgl';


const Classes ={
  0 : "Oi",
  1 : "Bom/Boa",
  2 : "Amanha",
  3 : "Dia",
  4 : "Tarde",
  5 : "Tchau",
  6 : "Tudo Bem"
  
}



export default function App() {
  //RAF ID
  let requestAnimationFrameId = 0;
  const [ClassName, setClassName] = React.useState('_____');
  const [tfReady, setTfReady] = useState(false);
  const [hpmReady, setHpmReady] = useState(false);
  const [handposeModel, setHandposeModel] = useState(false);
  //performance hacks (Platform dependent)
  const textureDims =
    Platform.OS === 'ios'
      ? { width: 1080, height: 1920 }
      : { width: 1600, height: 1200 };
  const tensorDims = { width: 152, height: 200 };
  //TF Camera Decorator
  const TensorCamera = cameraWithTensors(Camera);
  const sideCamera = Camera.Constants.Type.front;

  const modelPose = handPoseDetection.SupportedModels.MediaPipeHands;
  const detectorConfig = {
    runtime: 'tfjs',
  };
  
  const estimationConfig = {flipHorizontal: false};
  let detector = null;
  let predict = new Array();
  var listHand = new Array();
  var listClass = new Array();

  var modelo = null

  var length = null;

  const n_classes = 5
  const n_frames = 8

  async function CriaModelo()
  {
    const dropout_probability = 0.2
    const n_channels = 63

    const poolSize ={ poolSize: 2}

    var input = tf.input({shape: [n_frames,n_channels]})

    const layerHigh_config1 = {filters: 8,kernelSize: 7, padding: "same", activation:'relu',inputShape: [n_frames,n_channels]}
    const layerHigh_config2 = {filters: 4,kernelSize: 7, padding: "same", activation:'relu',}

    const layerLow_config1 = {filters: 8,kernelSize: 3, padding: "same", activation:'relu',inputShape: [n_frames,n_channels]}
    const layerLow_config2 = {filters: 4,kernelSize: 3, padding: "same", activation:'relu'}


    //High Branch
    let high = tf.layers.conv1d(layerHigh_config1).apply(input);

    high = tf.layers.averagePooling1d(poolSize).apply(high); 
    
    high = tf.layers.conv1d(layerHigh_config2).apply(high);
    
    high = tf.layers.averagePooling1d(poolSize).apply(high);

    high = tf.layers.conv1d(layerHigh_config2).apply(high);

    high = tf.layers.dropout(dropout_probability).apply(high);
    
    high = tf.layers.averagePooling1d(poolSize).apply(high);


    //Low Branch
    let low = tf.layers.conv1d(layerLow_config1).apply(input);
    
    low = tf.layers.averagePooling1d(poolSize).apply(low);

    low = tf.layers.conv1d(layerLow_config2).apply(low);
    
    low = tf.layers.averagePooling1d(poolSize).apply(low);

   low = tf.layers.conv1d(layerLow_config2).apply(low);

    low = tf.layers.dropout(dropout_probability).apply(low);
    
    low = tf.layers.averagePooling1d(poolSize).apply(low);


    var feature = tf.layers.concatenate().apply([high,low]);
    //var teste = tf.layers.flatten().apply(feature)
     

    const dense_config1 = {
      units: 1936,
      activation: 'relu'
    } 

    const dense_config2 = {
      units: n_classes,
      activation: 'softmax',
      batchSize : 1
    }
    
    var dense = tf.layers.dense(dense_config1).apply(feature)
    var model_output = tf.layers.dense(dense_config2).apply(dense)
    var model = tf.model({inputs: input, outputs: model_output })

    var learning_rate = 0.001
    var optimizer = tf.train.adam(learning_rate,0.9, 0.999, 1e-8);
    var metrics = ['accuracy']

    
    model.compile({optimizer, loss: "categoricalCrossentropy", metrics})
    model.summary()
    modelo = model; 
  }

  useEffect(() => {
    const init = async () => {
      if (!hpmReady && !tfReady) {
        console.log("Initializing...");
        tf.device_util.isMobile = () => true;
        tf.device_util.isBrowser = () => false;
        await tf.setBackend('rn-webgl');
        tf.ready()
          .then(() => {
            console.log(' backend tf is ready');
            console.log(tf.getBackend());
            setTfReady(true);   
            setHpmReady(true)   
          })
          .catch(e1 => {
            //console.error("TF init error", e1.message, e1.stack);
          })
      } 
      if(!handposeModel)
        await testeDetector()
    }
    init();
  },[])

  useEffect(() => {
    return () => {
      console.log("Cancelling animation frame: ", requestAnimationFrameId);
      cancelAnimationFrame(requestAnimationFrameId);
    };
  }, [requestAnimationFrameId]);

  async function testeDetector()
  {

    //await CriaModelo()
    detector = await handPoseDetection.createDetector(modelPose, detectorConfig);
    listHand.push(new Array()) 
    listHand.push(new Array()) 

    try
    {
      modelo = await tf.loadLayersModel(asyncStorageIO('model'))
      mode.setModel(modelo)
      setHandposeModel(true);
      return;
    }catch(err)
    {}

    axiosF.getAllHands().then(async (all) =>{

      if(all.classes.length == 0)
      {
        console.log("Carregando Fotos")
        axiosF.getLength().then( async len =>{
          length = len
          await ConvertImages(0)
        });
      }
      else
      {
        //all = await randomize(all)
        console.log("criando modelo")
        await CriaModelo()
        await TrainModel(all)
      }
        
    })
  }

  async function randomize(all)
  {
    console.log(all)
    var classes = new Array();
    var hands = new Array();
    while(all.classes.length > 0)
    {
      let pos = Math.floor(Math.random(), all.classes.length)
      classes.push(all.classes[pos])
      hands.push(all.hands[pos])
      all.classes.splice(pos,1);
      all.hands.splice(pos,1);
    }

    all.classes = classes;
    all.hands = hands;

    console.log(all.classes)
      
  }

  async function vetOutput(classes)
  {
    var array = new Array(classes.length);
    var i =0;
    for(var numClass of classes)
    {
      var temp = new Array(n_classes);
      temp.fill(0);
      temp[numClass] = 1;
      array[i] = new Array()
      array[i].push(temp);
      i++;
    }

    return array;
  }
  async function ConvertImages(numberClass)
  {
    if(numberClass < length && numberClass < n_classes)
    {
      var i =1;
      var data = await axiosF.getHandsData(numberClass,i++)
      while(data.length > 0)
      {
        console.log(`Class: ${numberClass+1}, Video: ${i-1}`)
        await v6(data,numberClass)
        data = await axiosF.getHandsData(numberClass,i++)
      }
      await ConvertImages(++numberClass)
    }else
    {
      console.log("GET Hands finalizado")
    }
  }

  async function v6(data,numberClass)
  {
    for(var image of data)
    {
      await ConvertImageToHandsPoints(image,numberClass)
    }
  }

  async function ConvertImageToHandsPoints(image,numberClass)
  {
    var array = new Array(image.length > n_frames? n_frames : image.length );
    var i=0;
    for(var frame of image)
    {
      if(i == n_frames) break;
      array[i] = await getHandPoints(frame,i)
      i++;
    }
    await axiosF.postHands(array,numberClass)
  }

  async function TrainModel(all)
  {
    var hands = await all.hands.slice(0,all.classes.length) 

    var output = await vetOutput(all.classes)
    
    await modelo.fit(tf.tensor(hands),tf.tensor(output) ,{epochs: 100})

    mode.setModel(modelo);

    console.log("treino realizado")

    var array = new Array()
    array.push(hands[3])
    await modelo.save(asyncStorageIO('model'));
    setHandposeModel(true)
    modelo.predict(tf.tensor(array)).print();
  }

  async function getHandPoints(frame,i)
  {
    
    var hands = await detector.estimateHands(tf.tensor(frame))
    try
    {
      return convertFingertoArray(hands[0].keypoints3D)
    }
    catch(err)
    {
      console.log(i)
      console.log("erro get fingers")
      var array = new Array(63)
      array.fill(0);
      return array;
    }
    
  }

  function convertFingertoArray(hand)
  {
    var array = new Array();
    for(var finger of hand)
    {
      array.push(finger.x);
      array.push(finger.y);
      array.push(finger.z);
      
    }
    return array;
    //console.log(listHand)
  }

  async function GetValuesInVector(hands)  
  {
    //side == 0(back) / side ==1(front)(invertido)
    
    var list = [];

    const left = sideCamera == 0? "left": "right";
    const right = sideCamera == 0? "right" : "left";

    
    if(!hands)
      return

    if(!hands[1])
      hands[1] = "";
    try
    {
      var handOne = hands[0].keypoints3D 
      var handTwo = hands[1].keypoints3D

      console.log("LEFT",handOne);
      console.log("RIGHT",handTwo);
    }catch(ex)
    {
      //
    }
    
    
  }


  async function GetClassName(tensorArray)
  {
    console.log(tensorArray.dataSync())
    var array = await tensorArray.dataSync();
    var max = Math.max(...array)
    const percent = 0.80
    console.log(max)
    if(max < percent)
    {
      setClassName("____");
      return;
    }
    setClassName(Classes[array.indexOf(max)])
  }

  async function handleCameraStreamV2(images, updatePreview, gl) {
    const loop = async () => {
      if (tfReady && hpmReady && handposeModel){
        
        try
        {
          const nextImageTensor = images.next().value
        //console.log("imageAsTensors: ", JSON.stringify(nextImageTensor))
        const values = nextImageTensor.dataSync();
        //let detector = await handPoseDetection.createDetector(model, detectorConfig);
        const arr = Array.from(values);
        if (nextImageTensor){
          try{
              detector.estimateHands(nextImageTensor)
              .then(async hands =>
              {
                if(hands[0])
                  {
                    predict.push(convertFingertoArray(hands[0].keypoints3D))

                    if(predict.length > n_frames)
                    {
                      predict.shift()
                    }

                    if(predict.length == n_frames)
                    {
                      var temp = new Array()
                      temp.push(predict)
                      
                      GetClassName(await mode.predict(tf.tensor(temp)));
                      //predict = new Array();
                    
                      //console.log(teste)
                    }
                  }
                requestAnimationFrameId = requestAnimationFrame(loop);
              }).catch( (err) => {
                  console.log(err)
                  requestAnimationFrameId = requestAnimationFrame(loop);
                });
            }
            catch(e)
            {
              console.log("erro detector")
              detector = await handPoseDetection.createDetector(modelPose, detectorConfig);
              requestAnimationFrameId = requestAnimationFrame(loop);
            }
          
        }                
        }catch(e)
        {
          requestAnimationFrameId = requestAnimationFrame(loop);
        }
        
      }      
    }
    loop();
  }
  
  return (
    <View style={styles.container}>
      {hpmReady && tfReady ? 
        (<TensorCamera
            style={styles.camera}
            type={sideCamera}
            zoom={0}
            cameraTextureHeight={textureDims.height}
            cameraTextureWidth={textureDims.width}
            resizeHeight={tensorDims.height}
            resizeWidth={tensorDims.width}
            resizeDepth={3}
            onReady={handleCameraStreamV2}
            autorender={true}
          />
        ) : (<Text style={styles.camera}></Text>)}
        {handposeModel ? (
          <Text>{""}</Text>
        ) : (
          <Text>{"Inicializando"}</Text>
        )}
        <Text style={styles.ClassText}>{"\n"}</Text>
        <Text>{"\n"}</Text>
        <Text>{"\n"}</Text>
        <Text>{"\n"}</Text>
        <Text>{"\n"}</Text>
        
        <Text style={styles.ClassText}>{ClassName}</Text>
      </View>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Constants.statusBarHeight,
    backgroundColor: '#ecf0f1',
  },
  camera: {
    position: 'absolute',
    left: 50,
    top: 30,
    width: 316,
    height: 507,
    zIndex: 1,
    
    borderWidth: 1,
    borderColor: 'black',
    borderRadius: 0,
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  ClassText: {
    fontSize: 45,
    fontFamily: "Cochin",
    fontWeight: "bold",
    //transform: [{ rotate: '-90deg'}],
  }
});

