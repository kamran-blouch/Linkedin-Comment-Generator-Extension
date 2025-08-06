import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Use service role key to bypass RLS for extension users
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { postCaption, tone, model, hint, userId } = await req.json();
    // Log the received data for debugging
    console.log('Received data:', {
      postCaption: postCaption?.substring(0, 50) + '...',
      tone,
      model,
      hint,
      userId,
      userIdType: typeof userId
    });
    if (!openAIApiKey) {
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Validate userId is a proper UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (userId && !uuidRegex.test(userId)) {
      console.error('Invalid UUID format:', userId);
    // Continue without saving to database, but still generate comment
    }
    // If hint is provided, get the last comment for this user
    let lastComment = null;
    if (hint && userId && uuidRegex.test(userId)) {
      try {
        const { data: lastCommentData, error: fetchError } = await supabase.from('generated_comments').select('generated_comment').eq('user_id', userId).order('created_at', {
          ascending: false
        }).limit(1).single();
        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching last comment:', fetchError);
        } else {
          lastComment = lastCommentData?.generated_comment;
        }
      } catch (error) {
        console.error('Error in last comment fetch:', error);
      }
    }
    // Build the system prompt based on tone and hint
    let systemPrompt = `You are an expert at writing engaging LinkedIn comments. Generate a thoughtful, professional comment based on the given post caption.

    Tone: ${tone}
    
    Guidelines:
    - Keep it concise (1-3 sentences)
    - Make it engaging and relevant to the post
    - Avoid generic responses
    - Add value to the conversation
    ${hint ? `- Additional guidance: ${hint}` : ''}
    ${lastComment && hint ? `- Previous comment to improve: "${lastComment}"` : ''}
    
    Return only the comment text, no quotes or extra formatting.`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Post caption: "${postCaption}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });
    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return new Response(JSON.stringify({
        error: 'Failed to generate comment'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const data = await response.json();
    const generatedComment = data.choices[0].message.content.trim();
    // Store the generated comment in database
    // Only try to save if we have valid UUID and required data
    if (userId && uuidRegex.test(userId) && postCaption && generatedComment) {
      console.log('Attempting to insert into database...');
      try {
        const insertData = {
          user_id: userId,
          post_caption: postCaption.substring(0, 1000),
          tone: tone || 'professional',
          model: model || 'gpt-4o-mini',
          hint: hint || null,
          generated_comment: generatedComment
        };
        // 💡 Ensure no 'id' key exists AT ALL (not even undefined/null)
        if ('id' in insertData) {
          delete insertData.id;
        }
        console.log('Insert data:', {
          ...insertData,
          post_caption: insertData.post_caption.substring(0, 50) + '...'
        });
        // Use service role client to bypass RLS
        const { data: insertResult, error: insertError } = await supabase.from('generated_comments').insert(insertData);
        if (insertError) {
          console.error('Database insert error:', insertError);
          console.error('Error details:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          });
        } else {
          console.log('Successfully inserted into database:', insertResult);
        }
      } catch (dbError) {
        console.error('Database operation failed:', dbError);
      }
    } else {
      console.log('Skipping database insert. Validation failed:', {
        hasUserId: !!userId,
        isValidUUID: userId ? uuidRegex.test(userId) : false,
        hasPostCaption: !!postCaption,
        hasGeneratedComment: !!generatedComment
      });
    }
    return new Response(JSON.stringify({
      generatedComment
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in generate-comment function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
