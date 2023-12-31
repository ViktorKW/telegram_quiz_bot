import { Question, decodeQuestion, getQuestion } from "../api/getQuestion"
import { CategoryOption } from "../model/IUser"
import { MyConversation, MyContext } from "../model/myContext"
import { Keyboard } from "grammy"
import { next_question_text, settings_text, show_stats_text } from "../model/texts"
import { initializeBot } from "../initializeBot"

export async function quizConversation(conversation: MyConversation, ctx: MyContext){
    const {token, categories} = conversation.session
    const chosen_category_index = selectRandomCategoryIndex(categories)

    const {response_code, results} = await conversation.external(async ()=>await getQuestion(token, categories[chosen_category_index].id)) 

    if(response_code === 0 && results.length > 0){
        const encoded_question:Question = results[0]
        const question = decodeQuestion(encoded_question)
        const question_keyboard = createQuestionKeyboard(question)

        await ctx.reply(`❓ ${question.question}`, {
            reply_markup: question_keyboard
        })
                
        const { message } = await conversation.waitFor(":text")
        const all_question_choices = [question.correct_answer, ...question.incorrect_answers]

        if(message?.text && all_question_choices.includes(message.text)){
            const is_correct = message?.text?.toLowerCase() === question.correct_answer.toLowerCase()
            const reply_message = is_correct
                ? "✅ You're correct!"
                : `❌ You're wrong! Correct answer is ${question.correct_answer}`
            
            if (is_correct === true){
                conversation.session.categories[chosen_category_index].correct_answers_number++
            } else if(is_correct === false){
                conversation.session.categories[chosen_category_index].incorrect_answers_number++
            }

            const keyboard = new Keyboard().persistent().oneTime()
                .text(next_question_text).row()
                .text(settings_text).text(show_stats_text)
        
            await ctx.reply(reply_message, { 
                reply_markup: keyboard
            })
        } else{
            conversation.log("Not a valid answer. Skip")
        }
    } else if(response_code === 1){
        conversation.log("Could not return results. The API doesn't have enough questions for your query. (Ex. Asking for 50 Questions in a Category that only has 20.)")
    } else if(response_code === 2){
        conversation.log("Invalid Parameter Contains an invalid parameter. Arguements passed in aren't valid. (Ex. Amount = Five)")
    } else if(response_code === 3){
        conversation.log("Code 3: Token Not Found Session Token does not exist.")
        await conversation.external(async ()=>{ await initializeBot(ctx)} )
        await quizConversation(conversation, ctx)
    } else if(response_code === 4){
        conversation.log("Token Empty Session Token has returned all possible questions for the specified query. Resetting the Token is necessary.")

        await ctx.reply(`You've answered all questions from ${categories[chosen_category_index].name} category. I'll remove it from the queue.`)

        conversation.session.categories[chosen_category_index].checked = false
    } else {
        conversation.log("Question not found")
    }
}   

function shuffleArray<T>(array: T[]): T[] {
    const shuffledArray = [...array]
  
    for (let i = shuffledArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]]
    }
  
    return shuffledArray
}

function createQuestionKeyboard(question:Question):Keyboard{
    const keyboard = new Keyboard().oneTime().persistent()
    
    if(question.type === "boolean"){
        keyboard.text("True").text("False")

        return keyboard
    } else{
        const question_answers:string[] = [...question.incorrect_answers, question.correct_answer]
        const shuffled_question_answers = shuffleArray(question_answers)
        console.log(shuffled_question_answers)

        for(const question_string of shuffled_question_answers){
            keyboard.text(question_string).row()
        }     

        return keyboard 
    }
}

function selectRandomCategoryIndex(categories:CategoryOption[]):number{
    const chosen_category_options = categories.filter((item)=>{
        return item.checked === true
    })

    if(chosen_category_options.length > 0){
        const random_index = getRandomArrayIndex(chosen_category_options)
        return categories.indexOf(chosen_category_options[random_index])
    } else{
        return getRandomArrayIndex(categories)
    }
}

function getRandomArrayIndex<T>(array:T[]):number{
    return Math.floor(Math.random()*array.length)
}