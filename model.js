var model = null;


module.exports = {

    setModel: (modelo) =>{
        model = modelo;
    },

    summary: ()=>{
        model.summary();
    },

    getModel: () =>{
        return model;
    },
    print: () =>{
        console.log(model)
    },

    predict: async (tensor) =>{
        return await model.predict(tensor);
    },

    predictPrint: async (tensor) =>{
        await model.predict(tensor).print()
    }
}