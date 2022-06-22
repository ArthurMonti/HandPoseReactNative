import axios from 'axios'


const baseUrl = 'http://192.168.0.109:3030'

module.exports =
{

    getData : async () =>{

        try
        {
            var dataBase = await axios.get(`${baseUrl}/teste`)
            console.log(dataBase)
            return dataBase.data.data;
        }catch(err){
            console.log("GetData Erro:", err)
            return null;
        }
        
    },

    getAllHands: async () =>{
        var res = await axios.get(`${baseUrl}/allhands`)
        return {hands: res.data.hands, classes: res.data.classes}
    },

    getLength: async () =>{
        var data = await axios.get(`${baseUrl}/length`)
        return data.data.length;
    },

    postHands: async (hand,numberClass) => {

        axios.post(`${baseUrl}/hands?class=${numberClass}`,{
            hand: hand
        }).catch(err =>
            {
                console.log(err);
            })
    },


    getModel: async () =>{
        var data = await axios.get(`${baseUrl}/model`)
        return data.data;
    },

    testModel: async (tensor) =>{
        axios.post(`${baseUrl}/testmodel`,{
            tensor: tensor
        }).catch(err =>
            {
                console.log(err);
            })
    },

    postModel: async (model) => {

        axios.post(`${baseUrl}/model`,{
            model: model
        })
        .catch(err =>
        {
            console.log(err);
        })
    },

    getHandsData: async (numberClass,start) =>{
       
        var end = start + 1;
        var res =  await axios.get(`${baseUrl}/handData?class=${numberClass}&start=${start}&end=${end}`)
        return res.data.data; 
        
       
    }



}